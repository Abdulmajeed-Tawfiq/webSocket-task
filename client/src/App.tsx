import { useCallback, useEffect, useState } from 'react';
import useWebSocket from 'react-use-websocket';

export const App = () => {
  const [messageHistory, setMessageHistory] = useState<string>('');
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const [lastProcessedIndex, setLastProcessedIndex] = useState<number>(0);

  const { sendMessage, lastMessage } = useWebSocket("wss://api.creatorwithai.com/ws/25", {
    onOpen: () => console.log('WebSocket connection opened'),
    onClose: () => console.log('WebSocket connection closed'),
    onError: (event: Event) => {
      const errorMessage = `WebSocket error: ${(event as ErrorEvent).message}`;
      setLogMessages(prev => [...prev, errorMessage]);
    },
    shouldReconnect: () => true,
  });

  const extractIndexes = (message: string): { start: number; end: number; content: string } | null => {
    const parts = message.split(":");
    if (parts.length < 2) return null;
    const [startStr, rest] = parts;
    const [endStr, ...contentParts] = rest.split(" ");
    return {
      start: Number(startStr),
      end: Number(endStr),
      content: contentParts.join(" ")
    };
  };

  const extractDone = (message: string): number | null => {
    const match = message.match(/^<DONE:(\d+)>$/);
    return match ? parseInt(match[1]) : null;
  };

  const handleMessage = useCallback((message: string) => {
    setLogMessages(prev => [...prev, `Received: ${message}`]);

    const doneIndex = extractDone(message);
    if (doneIndex !== null) {
      if (lastProcessedIndex !== doneIndex) {
        sendMessage(`<INDEX:${lastProcessedIndex}>`);
      } else {
        sendMessage("<CLOSE_REQ>");
      }
      return;
    }

    const indexes = extractIndexes(message);
    if (indexes) {
      const { start, end, content } = indexes;
      if (start !== lastProcessedIndex) {
        sendMessage(`<INDEX:${lastProcessedIndex}>`);
        return;
      }
      setMessageHistory(prev => prev + content);
      setLastProcessedIndex(end);
    } else if (message === '<CLOSE_ACC>') {
      setLogMessages(prev => [...prev, 'Connection closed by server']);
    } else {
      const parts = message.split(":");
      if (parts.length > 1) {
        setMessageHistory(prev => prev + parts.slice(1).join(":"));
      } else {
        setMessageHistory(prev => prev + message);
      }
    }
  }, [lastProcessedIndex, sendMessage]);

  const handleClickSendMessage = useCallback(() => {
    sendMessage('Write me a thread about business strategies.');
    setLogMessages(prev => [...prev, 'Sent: Write me a thread about business strategies.']);
    setLastProcessedIndex(0);
    setMessageHistory('');
  }, [sendMessage]);

  useEffect(() => {
    if (lastMessage !== null) {
      handleMessage(lastMessage.data);
    }
  }, [lastMessage, handleMessage]);

  return (
    <div className="websocket-container">
      <div className="button-group">
        <button
          onClick={handleClickSendMessage}
        >
          Start WebSocket Connection
        </button>
      </div>
      <div className="content-area">
        <div className="text-area">
          <h3>Generated Text:</h3>
          <textarea
            value={messageHistory}
            readOnly
            style={{ width: '100%', minHeight: '200px', resize: 'vertical' }}
          />
        </div>
        <div className="log-area">
          <h3>Message Log:</h3>
          <textarea
            value={logMessages.join('\n')}
            readOnly
            style={{ width: '100%', minHeight: '200px', resize: 'vertical' }}
          />
        </div>
      </div>
    </div>
  );
};