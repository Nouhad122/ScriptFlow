import express from 'express';
import cors from 'cors';
import healthRoutes from './routes/health.routes';
import ideasRoutes from './routes/ideas.routes';
import pipelineRoutes from './routes/pipeline.routes';
import scriptsRoutes from './routes/scripts.routes';
import dashboardRoutes from './routes/dashboard.routes';
import memoryRoutes from './routes/memory.routes';
import clientsRoutes from './routes/clients.routes';

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
app.use('/api/scripts', scriptsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/memory', memoryRoutes);
app.use('/api/clients', clientsRoutes);

export default app;
