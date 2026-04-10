import React, { useEffect, useRef, useState } from 'react'
import io from "socket.io-client";
import { Badge, IconButton, TextField } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Button } from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import styles from "../styles/videoComponent.module.css";
import CallEndIcon from '@mui/icons-material/CallEnd'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare'
import ChatIcon from '@mui/icons-material/Chat'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import FlipCameraIosIcon from '@mui/icons-material/FlipCameraIos';
import { AuthContext } from '../contexts/AuthContext';
import { useContext } from 'react';
import server from '../environment';

const server_url = server;

var connections = {};

const peerConfigConnections = {
    "iceServers": [
        { "urls": "stun:stun.l.google.com:19302" }
    ]
}

export default function VideoMeetComponent() {

    var socketRef = useRef();
    let socketIdRef = useRef();
    const navigate = useNavigate();

    let localVideoref = useRef();
    const { addToUserHistory } = useContext(AuthContext);
    const [videoAvailable, setVideoAvailable] = useState(false);
    const [audioAvailable, setAudioAvailable] = useState(false);
    const [video, setVideo] = useState();
    const [audio, setAudio] = useState();
    const [screen, setScreen] = useState(false);
    const [showModal, setModal] = useState(true);
    const [screenAvailable, setScreenAvailable] = useState(false);
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState("");
    const [newMessages, setNewMessages] = useState(3);
    const [askForUsername, setAskForUsername] = useState(true);
    const [username, setUsername] = useState("");
    const videoRef = useRef([]);
    const [videos, setVideos] = useState([]);
    const initialSetupRef = useRef(true);
    const [isFrontCamera, setIsFrontCamera] = useState(true);

    const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }, 10000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        getPermissions();
    }, []);

    const getPermissions = async () => {
        try {
            let videoAvail = false;
            let audioAvail = false;

            try {
                const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
                videoAvail = true;
                setVideoAvailable(true);
                console.log('Video permission granted');
                // Stop the test stream immediately so it doesn't interfere
                videoStream.getTracks().forEach(track => track.stop());
            } catch (e) {
                console.log('Video permission denied');
            }

            try {
                const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioAvail = true;
                setAudioAvailable(true);
                console.log('Audio permission granted');
                // Stop the test stream immediately
                audioStream.getTracks().forEach(track => track.stop());
            } catch (e) {
                console.log('Audio permission denied');
            }

            if (navigator.mediaDevices.getDisplayMedia) {
                setScreenAvailable(true);
            }

            if (videoAvail || audioAvail) {
                const userMediaStream = await navigator.mediaDevices.getUserMedia({
                    video: videoAvail,
                    audio: audioAvail
                });
                if (userMediaStream) {
                    window.localStream = userMediaStream;
                    if (localVideoref.current) {
                        localVideoref.current.srcObject = userMediaStream;
                    }
                }
            }
        } catch (error) {
            console.log(error);
        }
    };

    useEffect(() => {
        if (localVideoref.current && window.localStream) {
            localVideoref.current.srcObject = window.localStream;
        }
    }, [askForUsername, videoAvailable, audioAvailable]);

    useEffect(() => {
        if (video !== undefined || audio !== undefined) {
            if (initialSetupRef.current) {
                initialSetupRef.current = false;
                return;
            }
            // Track enable/disable is handled directly in handleVideo/handleAudio
            console.log("SET STATE HAS ", video, audio);
        }
    }, [video, audio]);

    const getMedia = () => {
        setVideo(videoAvailable);
        setAudio(audioAvailable);
        connectToSocketServer();
    };





    let getUserMediaSuccess = (stream) => {
        try {
            window.localStream.getTracks().forEach(track => track.stop())
        } catch (e) { console.log(e) }

        window.localStream = stream
        localVideoref.current.srcObject = stream

        for (let id in connections) {
            if (id === socketIdRef.current) continue

            connections[id].addStream(window.localStream)

            connections[id].createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true }).then((description) => {
                connections[id].setLocalDescription(description)
                    .then(() => {
                        socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
                    })
                    .catch(e => console.log(e))
            })
        }

        stream.getTracks().forEach(track => track.onended = () => {
            setVideo(false);
            setAudio(false);

            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { console.log(e) }

            let blackSilence = (...args) => new MediaStream([black(...args), silence()])
            window.localStream = blackSilence()
            localVideoref.current.srcObject = window.localStream

            for (let id in connections) {
                connections[id].addStream(window.localStream)

                connections[id].createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true }).then((description) => {
                    connections[id].setLocalDescription(description)
                        .then(() => {
                            socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
                        })
                        .catch(e => console.log(e))
                })
            }
        })
    }

    let getUserMedia = () => {
        if ((video && videoAvailable) || (audio && audioAvailable)) {
            navigator.mediaDevices.getUserMedia({ video: video, audio: audio })
                .then(getUserMediaSuccess)
                .then((stream) => { })
                .catch((e) => console.log(e))
        } else {
            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { }
        }
    }





    let getDislayMedia = () => {
        if (screen) {
            if (navigator.mediaDevices.getDisplayMedia) {
                navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
                    .then(getDislayMediaSuccess)
                    .then((stream) => { })
                    .catch((e) => console.log(e))
            }
        }
    }

    let getDislayMediaSuccess = (stream) => {
        console.log("HERE")
        try {
            window.localStream.getTracks().forEach(track => track.stop())
        } catch (e) { console.log(e) }

        window.localStream = stream
        localVideoref.current.srcObject = stream

        for (let id in connections) {
            if (id === socketIdRef.current) continue

            connections[id].addStream(window.localStream)

            connections[id].createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true }).then((description) => {
                connections[id].setLocalDescription(description)
                    .then(() => {
                        socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
                    })
                    .catch(e => console.log(e))
            })
        }

        stream.getTracks().forEach(track => track.onended = () => {
            setScreen(false)

            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { console.log(e) }

            let blackSilence = (...args) => new MediaStream([black(...args), silence()])
            window.localStream = blackSilence()
            localVideoref.current.srcObject = window.localStream

            getUserMedia()

        })
    }


    let gotMessageFromServer = (fromId, message) => {
        var signal = JSON.parse(message)

        if (fromId !== socketIdRef.current) {
            if (signal.sdp) {
                connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
                    if (signal.sdp.type === 'offer') {
                        connections[fromId].createAnswer().then((description) => {
                            connections[fromId].setLocalDescription(description).then(() => {
                                socketRef.current.emit('signal', fromId, JSON.stringify({ 'sdp': connections[fromId].localDescription }))
                            }).catch(e => console.log(e))
                        }).catch(e => console.log(e))
                    }
                }).catch(e => console.log(e))
            }

            if (signal.ice) {
                connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e => console.log(e))
            }
        }
    }




    const setupNewConnection = (socketListId, makeOffer) => {
        connections[socketListId] = new RTCPeerConnection(peerConfigConnections)

        // Wait for their ice candidate       
        connections[socketListId].onicecandidate = function (event) {
            if (event.candidate != null) {
                socketRef.current.emit('signal', socketListId, JSON.stringify({ 'ice': event.candidate }))
            }
        }

        // Wait for their video stream
        connections[socketListId].onaddstream = (event) => {
            let videoExists = videoRef.current.find(video => video.socketId === socketListId);

            if (videoExists) {
                setVideos(videos => {
                    const updatedVideos = videos.map(video =>
                        video.socketId === socketListId ? { ...video, stream: event.stream } : video
                    );
                    videoRef.current = updatedVideos;
                    return updatedVideos;
                });
            } else {
                let newVideo = {
                    socketId: socketListId,
                    stream: event.stream,
                    autoplay: true,
                    playsinline: true
                };

                setVideos(videos => {
                    const updatedVideos = [...videos, newVideo];
                    videoRef.current = updatedVideos;
                    return updatedVideos;
                });
            }

            // Sync current state to new user
            socketRef.current.emit("user-state", { video, audio });
        };

        // Add the local video stream
        if (window.localStream !== undefined && window.localStream !== null) {
            connections[socketListId].addStream(window.localStream)
        } else {
            let blackSilence = (...args) => new MediaStream([black(), silence()])
            window.localStream = blackSilence()
            connections[socketListId].addStream(window.localStream)
        }

        if (makeOffer) {
            connections[socketListId].createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true }).then((description) => {
                connections[socketListId].setLocalDescription(description)
                    .then(() => {
                        socketRef.current.emit('signal', socketListId, JSON.stringify({ 'sdp': connections[socketListId].localDescription }))
                    })
                    .catch(e => console.log(e))
            })
        }
    }

    const connectToSocketServer = () => {
        socketRef.current = io.connect(server_url, { secure: false });

        socketRef.current.on('signal', gotMessageFromServer);

        socketRef.current.on('connect', () => {
            socketRef.current.emit('join-call', window.location.href);
            socketIdRef.current = socketRef.current.id;

            socketRef.current.on('chat-message', addMessage);

            socketRef.current.on('user-left', (id) => {
                setVideos((videos) => videos.filter((video) => video.socketId !== id));
            });

            socketRef.current.on('user-joined', (id, clients) => {
                // If I am the one who just joined, connect to all existing clients
                if (id === socketIdRef.current) {
                    clients.forEach((socketListId) => {
                        if (socketListId === socketIdRef.current) return;

                        setupNewConnection(socketListId, true);
                    });
                } else {
                    // If someone else joined, just connect to that new person
                    console.log("User joined, connecting to: ", id);
                    setupNewConnection(id, false);
                }
            });

            socketRef.current.on('user-state', (id, state) => {
                setVideos(videos => videos.map(v => 
                    v.socketId === id ? { ...v, videoOff: !state.video, audioOff: !state.audio } : v
                ));
            });
        })
    };


    let silence = () => {
        let ctx = new AudioContext()
        let oscillator = ctx.createOscillator()
        let dst = oscillator.connect(ctx.createMediaStreamDestination())
        oscillator.start()
        ctx.resume()
        return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false })
    }
    let black = ({ width = 640, height = 480 } = {}) => {
        let canvas = Object.assign(document.createElement("canvas"), { width, height })
        canvas.getContext('2d').fillRect(0, 0, width, height)
        let stream = canvas.captureStream()
        return Object.assign(stream.getVideoTracks()[0], { enabled: false })
    }

    let handleVideo = () => {
        setVideo(!video);
        // Toggle video track on/off without creating a new stream
        if (window.localStream) {
            window.localStream.getVideoTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
        }
        socketRef.current?.emit("user-state", { video: !video, audio });
    }
    let handleAudio = () => {
        setAudio(!audio)
        // Toggle audio track on/off without creating a new stream
        if (window.localStream) {
            window.localStream.getAudioTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
        }
        socketRef.current?.emit("user-state", { video, audio: !audio });
    }

    useEffect(() => {
        if (screen !== undefined) {
            getDislayMedia();
        }
    }, [screen])
    let handleScreen = () => {
        setScreen(!screen);
    }

    let toggleCamera = async () => {
        const newMode = !isFrontCamera;
        setIsFrontCamera(newMode);
        
        const constraints = {
            video: { facingMode: newMode ? "user" : { ideal: "environment" } },
            audio: audio
        };

        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            const newTrack = stream.getVideoTracks()[0];

            // Update local preview
            if (localVideoref.current) {
                localVideoref.current.srcObject = stream;
            }

            // Replace track for all existing connections
            for (let id in connections) {
                const senders = connections[id].getSenders();
                const videoSender = senders.find(sender => sender.track && sender.track.kind === 'video');
                if (videoSender) {
                    videoSender.replaceTrack(newTrack);
                }
            }

            // Stop old tracks to save battery/resources
            if (window.localStream) {
                window.localStream.getVideoTracks().forEach(track => track.stop());
            }

            window.localStream = stream;
            setVideo(true);
            socketRef.current?.emit("user-state", { video: true, audio });

        } catch (e) {
            console.error("Error switching camera:", e);
        }
    };

    let handleEndCall = () => {
        try {
            let tracks = localVideoref.current.srcObject.getTracks()
            tracks.forEach(track => track.stop())
        } catch (e) { }
        navigate("/home")
    }

    let openChat = () => {
        setModal(true);
        setNewMessages(0);
    }
    let closeChat = () => {
        setModal(false);
    }
    let handleMessage = (e) => {
        setMessage(e.target.value);
    }

    const addMessage = (data, sender, socketIdSender) => {
        setMessages((prevMessages) => [
            ...prevMessages,
            { sender: sender, data: data }
        ]);
        if (socketIdSender !== socketIdRef.current) {
            setNewMessages((prevNewMessages) => prevNewMessages + 1);
        }
    };



    let sendMessage = () => {
        console.log(socketRef.current);
        socketRef.current.emit('chat-message', message, username)
        setMessage("");

        // this.setState({ message: "", sender: username })
    }


    let connect = () => {
        setAskForUsername(false);
        getMedia();
        addToUserHistory(window.location.href);
    }


    const [dragPos, setDragPos] = useState({ x: 20, y: 110 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0 });

    const handleMouseDown = (e) => {
        setIsDragging(true);
        dragStartRef.current = {
            x: e.clientX - dragPos.x,
            y: window.innerHeight - e.clientY - dragPos.y
        };
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        setDragPos({
            x: e.clientX - dragStartRef.current.x,
            y: window.innerHeight - e.clientY - dragStartRef.current.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    return (
        <div style={{ backgroundColor: "#fcfdfe", minHeight: "100vh" }}>

            {askForUsername === true ?

                <div className={styles.lobbyContainer}>
                    <div className={styles.lobbyVideoView}>
                        <video ref={localVideoref} autoPlay muted></video>
                    </div>

                    <div className={styles.lobbyControls}>
                        <h2>Ready to join?</h2>
                        <TextField
                            id="outlined-basic"
                            label="Username"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            variant="outlined"
                            fullWidth
                            sx={{
                                input: { color: '#333' },
                                label: { color: 'rgba(0,0,0,0.6)' },
                                '& .MuiOutlinedInput-root': {
                                    '& fieldset': { borderColor: 'rgba(0,0,0,0.1)' },
                                    '&:hover fieldset': { borderColor: 'rgba(0,0,0,0.2)' },
                                }
                            }}
                        />
                        <Button
                            variant="contained"
                            onClick={connect}
                            size="large"
                            sx={{ borderRadius: '10px', height: '56px', fontSize: '1.1rem', backgroundColor: '#1976d2' }}
                        >
                            Enter Meeting
                        </Button>
                    </div>
                </div> :


                <div className={styles.meetVideoContainer}>

                    <div className={styles.mainConferenceArea}>
                        <div className={styles.conferenceView}>
                            {videos.map((video) => (
                                <div key={video.socketId} className={styles.videoWrapper}>
                                    <video
                                        data-socket={video.socketId}
                                        ref={ref => {
                                            if (ref && video.stream) {
                                                ref.srcObject = video.stream;
                                            }
                                        }}
                                        autoPlay
                                        playsInline
                                    ></video>
                                    <div className={styles.videoNameTag}>Participant {video.socketId.slice(0, 4)}</div>
                                    {video.videoOff && (
                                        <div className={styles.videoPlaceholder}>
                                            <div className={styles.avatar}>
                                                {video.socketId.slice(0, 2).toUpperCase()}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <video
                            className={styles.meetUserVideo}
                            ref={localVideoref}
                            autoPlay
                            muted
                            onMouseDown={handleMouseDown}
                            style={{
                                left: `${dragPos.x}px`,
                                bottom: `${dragPos.y}px`,
                                cursor: isDragging ? 'grabbing' : 'grab',
                            }}
                        ></video>

                        {showModal && (
                            <div className={styles.chatRoom}>
                                <div className={styles.chatContainer}>
                                    <h1>Meeting Chat</h1>
                                    <div className={styles.chattingDisplay}>
                                        {messages.length !== 0 ? messages.map((item, index) => (
                                            <div key={index}>
                                                <p>{item.sender}</p>
                                                <p>{item.data}</p>
                                            </div>
                                        )) : <p style={{ textAlign: "center", color: "rgba(0,0,0,0.3)", marginTop: "20px" }}>No messages yet</p>}
                                    </div>
                                    <div className={styles.chattingArea}>
                                        <TextField
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            placeholder="Send a message"
                                            variant="outlined"
                                            fullWidth
                                            sx={{ input: { color: '#333' } }}
                                        />
                                        <Button variant='contained' onClick={sendMessage}>Send</Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className={styles.footerBar}>
                        <div className={styles.footerLeft}>
                            <div className={styles.meetingTime}>{currentTime}</div>
                            <div className={styles.meetingDivider}>|</div>
                            <div className={styles.meetingCode}>Meeting Code</div>
                        </div>

                        <div className={styles.footerCenter}>
                            <IconButton onClick={handleVideo} className={video ? styles.controlBtn : styles.controlBtnOff}>
                                {video ? <VideocamIcon /> : <VideocamOffIcon />}
                            </IconButton>

                            <IconButton onClick={handleAudio} className={audio ? styles.controlBtn : styles.controlBtnOff}>
                                {audio ? <MicIcon /> : <MicOffIcon />}
                            </IconButton>

                            {screenAvailable && (
                                <IconButton onClick={handleScreen} className={screen ? styles.controlBtnActive : styles.controlBtn}>
                                    <ScreenShareIcon />
                                </IconButton>
                            )}

                            <IconButton onClick={toggleCamera} className={styles.controlBtn}>
                                <FlipCameraIosIcon />
                            </IconButton>

                            <IconButton onClick={handleEndCall} className={styles.endCallBtn}>
                                <CallEndIcon />
                            </IconButton>
                        </div>

                        <div className={styles.footerRight}>
                            <IconButton style={{ color: "#5f6368" }}>
                                <InfoOutlinedIcon />
                            </IconButton>
                            <IconButton style={{ color: "#5f6368" }}>
                                <PeopleAltOutlinedIcon />
                                <span className={styles.participantCount}>{videos.length + 1}</span>
                            </IconButton>
                            <Badge badgeContent={newMessages} color="primary">
                                <IconButton onClick={() => setModal(!showModal)} style={{ color: showModal ? "#1976d2" : "#5f6368" }}>
                                    <ChatBubbleOutlineIcon />
                                </IconButton>
                            </Badge>
                        </div>
                    </div>

                </div>

            }

        </div>
    )
}

