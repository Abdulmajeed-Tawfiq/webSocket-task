import { useState, useCallback, useEffect } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';

export const App = () => {
  const [messageHistory, setMessageHistory] = useState<string>('');
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { sendMessage, lastMessage, readyState } = useWebSocket("wss://api.creatorwithai.com/ws/11", {
    onError: (event: Event) => setError(`WebSocket error: ${(event as ErrorEvent).message}`),
    shouldReconnect: () => true,
  });

  const extractIndexes = (message: string): { start: number; end: number; content: string } | null => {
    const match = message.match(/^(\d+):(\d+) (.*)$/);
    return match ? {
      start: parseInt(match[1], 10),
      end: parseInt(match[2], 10),
      content: match[3]
    } : null;
  };

  const handleMessage = useCallback((message: string) => {
    const indexes = extractIndexes(message);
    console.log(indexes)
    if (indexes) {
      const { start, content } = indexes;
      if (messageHistory.length !== start) {
        setLogMessages(prev => [...prev, `Mismatch: Expected start ${messageHistory.length}, got ${start}`]);
        sendMessage(`<INDEX:${messageHistory.length}>`);
      } else {
        setMessageHistory(prev => prev + content);
      }
    }
    setLogMessages(prev => [...prev, `Received: ${message}`]);
  }, [messageHistory.length, sendMessage]);

  useEffect(() => {
    if (lastMessage !== null) {
      handleMessage(lastMessage.data);
    }
  }, [lastMessage, handleMessage]);

  const handleClickSendMessage = useCallback(() => {
    sendMessage('start the socket.');
    setLogMessages((prev) => [...prev, 'Sent: start the socket.']);
  }, [sendMessage]);

  const connectionStatus = {
    [ReadyState.CONNECTING]: 'Connecting',
    [ReadyState.OPEN]: 'Open',
    [ReadyState.CLOSING]: 'Closing',
    [ReadyState.CLOSED]: 'Closed',
    [ReadyState.UNINSTANTIATED]: 'Uninstantiated',
  }[readyState];

  return (
    <div className="websocket-container">
      <div className="button-group">
        <button
          onClick={handleClickSendMessage}
          disabled={readyState !== ReadyState.OPEN}
        >
          Start WebSocket Connection
        </button>
      </div>
      <div className="status">The WebSocket is currently {connectionStatus}</div>
      {error && <div className="error">{error}</div>}
      <div className="content-area">
        <div className="text-area">
          <h3>Generated Text:</h3>
          <textarea
            // className="message-history"
            value={messageHistory}
            readOnly
            style={{ width: '100%', minHeight: '200px', resize: 'vertical' }}
          />
        </div>
        <div className="log-area">
          <h3>Errors:</h3>
          <textarea
            className="log-messages"
            value={logMessages.join('\n')}
            readOnly
            style={{ width: '100%', minHeight: '200px', resize: 'vertical' }}
          />
        </div>
      </div>
    </div>
  );
};
