import express from 'express';
import cors from 'cors';
import healthRoutes from './routes/health.routes';
import ideasRoutes from './routes/ideas.routes';
import pipelineRoutes from './routes/pipeline.routes';

const app = express();

app.use(cors());
app.use(express.json());

// Basic server liveness check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/health', healthRoutes);
app.use('/api/ideas', ideasRoutes);
app.use('/api/pipeline', pipelineRoutes);

export default app;
