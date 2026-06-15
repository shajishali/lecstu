import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes';

const app = express();

app.use(cors({
  origin: config.clientUrl,
  credentials: true,
}));

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(cookieParser());

app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

app.use('/api', routes);

app.use(errorHandler);

export default app;
