// server.js
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.set('trust proxy', true)

app.use('/static', express.static(path.join(__dirname, 'static')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

app.get('/sw.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'service-worker.js'));
});

app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'favicon.ico'));
});

app.all('/backend/:appId/*', async (req, res) => {
    try {
        const appId = req.params.appId;
        const remainingPath = req.params[0].split('/');

        const modulePath = path.join(__dirname, 'backend', appId, 'index.js');
        if (!fs.existsSync(modulePath)) {
            return res.status(404).json({ error: 'App not found' });
        }

        const module = await import(`./backend/${appId}/index.js`);

        if (typeof module.handleRequest === 'function') {
            let resp = module.handleRequest(remainingPath, req.ip, req.body);
            res.status(resp.code || 200).send(resp.body)
        } else {
            res.status(500).json({ error: 'App handler not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});