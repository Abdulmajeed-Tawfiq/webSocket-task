import { useCallback, useEffect, useState } from 'react';
import useWebSocket from 'react-use-websocket';

export const App = () => {
  // State variables
  const [messageHistory, setMessageHistory] = useState<string>('');
  const [lastProcessedIndex, setLastProcessedIndex] = useState<number>(0);
  const [isSocketOpen, setIsSocketOpen] = useState<boolean>(false);
  const [logMessage, setLogMessage] = useState<number[]>([]);
  const [errorMessage, setErrorMessage] = useState<string[]>([]);
  const [systemLog, setSystemLog] = useState<string[]>([]);

  // WebSocket configuration
  const { sendMessage, lastMessage } = useWebSocket("wss://api.creatorwithai.com/ws/25", {
    onOpen: () => {
      setIsSocketOpen(false);
      setSystemLog(prevLog => [...prevLog, 'WebSocket connection opened']);
    },
    onMessage: () => {
      setIsSocketOpen(true);
    },
    onError: (event: Event) => {
      const errorMessage = `WebSocket error: ${(event as ErrorEvent).message}`;
      setSystemLog(prevLog => [...prevLog, errorMessage]);
    },
    shouldReconnect: () => true,
  });

  // Helper function to extract indexes from message
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

  // Helper function to extract done index from message
  const extractDone = (message: string): number | null => {
    const match = message.match(/^<DONE:(\d+)>$/);
    return match ? parseInt(match[1]) : null;
  };

  // Handle incoming WebSocket messages
  const handleMessage = useCallback((message: string) => {
    setSystemLog(prevLog => [...prevLog, `Received: ${message}`]);
    
    // Check if the message indicates completion
    const doneIndex = extractDone(message);
    if (doneIndex !== null) {
      if (lastProcessedIndex !== doneIndex) {
        sendMessage(`<INDEX:${lastProcessedIndex}>`);
        setSystemLog(prevLog => [...prevLog, `Sent: <INDEX:${lastProcessedIndex}>`]);
      } else {
        sendMessage("<CLOSE_REQ>");
        setSystemLog(prevLog => [...prevLog, 'Sent: <CLOSE_REQ>']);
      }
      return;
    }

    // Process message content
    const indexes = extractIndexes(message);
    if (indexes) {
      const { start, end, content } = indexes;
      if (start !== lastProcessedIndex) {
        sendMessage(`<INDEX:${lastProcessedIndex}>`);
        setSystemLog(prevLog => [...prevLog, `Sent: <INDEX:${lastProcessedIndex}>`]);
        setLogMessage(prevLog => [...prevLog, lastProcessedIndex]);
        
        // Check for duplicate log messages
        if (logMessage.filter((num, index, array) => array.indexOf(num) !== index).length > 0) {
          setErrorMessage(logMessage.filter((num, index, array) => array.indexOf(num) !== index).map(num => `Resend ${num}`));
          return;
        } else {
          return;
        }
      }
      setMessageHistory(prev => prev + content);
      setLastProcessedIndex(end);
    } else if (message === '<CLOSE_ACC>') {
      setSystemLog(prevLog => [...prevLog, 'Connection closed by server']);
    } else {
      // Handle other message formats
      const parts = message.split(":");
      if (parts.length > 1) {
        setMessageHistory(prev => prev + parts.slice(1).join(":"));
      } else {
        setMessageHistory(prev => prev + message);
      }
    }
  }, [lastProcessedIndex]);

  // Handle button click to start WebSocket connection
  const handleClickSendMessage = useCallback(() => {
    sendMessage('Write me a thread about business strategies.');
    setSystemLog(prevLog => [...prevLog, 'Sent: Write me a thread about business strategies.']);
    setLastProcessedIndex(0);
    setMessageHistory('');
    setLogMessage([]);
    setErrorMessage([]);
  }, [sendMessage]);

  // Effect to handle incoming messages
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
          disabled={isSocketOpen}
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
          <div className="text-area error-area">
            <h3>Error Log:</h3>
            <textarea
              value={errorMessage.join('\n')}
              readOnly
              style={{ width: '100%', minHeight: '200px', resize: 'vertical' }}
            />
          </div>
          <div className="text-area">
            <h3>System Log:</h3>
            <textarea
              value={systemLog.join('\n')}
              readOnly
              style={{ width: '100%', minHeight: '200px', resize: 'vertical' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};