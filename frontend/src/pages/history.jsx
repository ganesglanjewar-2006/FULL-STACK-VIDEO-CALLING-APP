import React, { useContext, useEffect, useState } from 'react'
import { AuthContext } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom';
import Card from '@mui/material/Card';
import Box from '@mui/material/Box';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import HomeIcon from '@mui/icons-material/Home';

import { IconButton } from '@mui/material';
export default function History() {


    const { getHistoryOfUser } = useContext(AuthContext);

    const [meetings, setMeetings] = useState([])


    const routeTo = useNavigate();

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const history = await getHistoryOfUser();
                if (Array.isArray(history)) {
                    setMeetings(history);
                } else {
                    console.error("History is not an array:", history);
                }
            } catch {
                // IMPLEMENT SNACKBAR
            }
        }

        fetchHistory();
    }, [])

    let formatDate = (dateString) => {

        const date = new Date(dateString);
        const day = date.getDate().toString().padStart(2, "0");
        const month = (date.getMonth() + 1).toString().padStart(2, "0")
        const year = date.getFullYear();

        return `${day}/${month}/${year}`

    }

    return (
        <div>

            <IconButton onClick={() => {
                routeTo("/home")
            }}>
                <HomeIcon />
            </IconButton >
            {
                (meetings.length !== 0) ? meetings.map((e, i) => {
                    return (
                        <Card key={i} variant="outlined" sx={{ mb: 2, borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', mx: 2 }}>
                            <CardContent>
                                <Typography sx={{ fontSize: 14, fontWeight: 600 }} color="primary" gutterBottom>
                                    Meeting Code: {e.meetingCode}
                                </Typography>
                                <Typography color="text.secondary">
                                    Date: {formatDate(e.date)}
                                </Typography>
                            </CardContent>
                        </Card>
                    )
                }) : (
                    <Box sx={{ p: 4, textAlign: 'center', opacity: 0.6 }}>
                        <Typography variant="h6">No meeting history found.</Typography>
                        <Typography variant="body2">Your past meetings will appear here.</Typography>
                    </Box>
                )
            }

        </div>
    )
}