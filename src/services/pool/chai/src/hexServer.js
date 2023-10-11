import express from 'express';
import { fork } from 'child_process';
import path from 'path';

const app = express();
const port = 3000;

// In-memory mapping of session to worker
const sessionToWorker = {};

app.use(express.urlencoded({ extended: true }));

const renderTemplate = (hexData = '', sessionId = '') => `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Hex Reader</title>
  </head>
  <body>
    <form action="/command" method="post">
      <input required type="hidden" name="sessionId" value="${sessionId}">
      <input name=filePath value="">
      <button type="submit" name="command" value="next">Next Page</button>
      <button type="submit" name="command" value="prev">Previous Page</button>
    </form>
    <pre>${escapeHTML(hexData)}</pre>
  </body>
  </html>
`;

app.get('/', (req, res) => {
  const sessionId = Date.now(); // For simplicity, we're using timestamp as session ID
  res.send(renderTemplate('', sessionId));
});

app.post('/command', (req, res) => {
  const { sessionId, command, filePath } = req.body;

  let worker = sessionToWorker[sessionId];
  
  if (!worker) {
    worker = fork(path.join('.', 'hexReader.js'));
    sessionToWorker[sessionId] = worker;

    // Initialize worker
    worker.send({ command: 'openFile', filePath });

    // Listen for messages from worker
    worker.on('message', (message) => {
      if (message.error) {
        console.error(`Worker error: ${message.error}`);
      }
    });
  }

  // Send the command to the worker
  worker.send({ command });

  worker.once('message', (message) => {
    if (message.error) {
      res.send(renderTemplate(`Error: ${message.error}`, sessionId));
    } else {
      res.send(renderTemplate(message.hexData, sessionId));
    }
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});

function escapeHTML(str) {
  const escapeChars = {
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&#39;'
  };

  return str.replace(/[<>&"']/g, (char) => escapeChars[char]);
}


