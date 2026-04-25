import { io } from "socket.io-client";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://riskguard-backend-g72j.onrender.com');

const socket = io(BACKEND_URL);

export default socket;