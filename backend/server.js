import express , {json} from "express";
import cors from "cors";
import {spawn} from "child_process";
import ragRoutes from './routes/ragRoutes.js'
import 'dotenv/config';

const app = express();
app.use(express.json())
const port = process.env.PORT || 3000; 

app.use(cors({
    origin : process.env.CORS_ORIGIN,
    credentials : true,
})
);


//RAG endpoint
app.use('/api',ragRoutes);

app.listen(port, () => {
    console.log(`Node.js RAG backend listening at http://localhost:${port}`);
});