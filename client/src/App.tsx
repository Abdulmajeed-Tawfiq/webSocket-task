import { useCallback, useEffect, useState } from 'react';
import useWebSocket from 'react-use-websocket';

export const App = () => {
  const [messageHistory, setMessageHistory] = useState<string>('');
  const [lastProcessedIndex, setLastProcessedIndex] = useState<number>(0);
  const [isSocketOpen, setIsSocketOpen] = useState<boolean>(false);
  const [logMessage, setLogMessage] = useState<number[]>([]);
  const [errorMessage, setErrorMessage] = useState<string[]>([]);

  const { sendMessage, lastMessage } = useWebSocket("wss://api.creatorwithai.com/ws/25", {
    onOpen: () => {
      console.log('WebSocket connection opened');
      setIsSocketOpen(false);
    },
    onMessage: () => {
      setIsSocketOpen(true);
    },
    onError: (event: Event) => {
      const logMessage = `WebSocket error: ${(event as ErrorEvent).message}`;
      console.log(logMessage)
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
    // console.log(message)

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
        setLogMessage([...logMessage, lastProcessedIndex]);
        if (logMessage.filter(num => num === lastProcessedIndex).length === 2) {
          console.error(`resend ${lastProcessedIndex}`);
          return;
        } else {
          console.log(`resend ${lastProcessedIndex}`);
          setErrorMessage([...errorMessage, "Resend " + lastProcessedIndex]);
          return;
        }
      }
      setMessageHistory(prev => prev + content);
      setLastProcessedIndex(end);
    } else if (message === '<CLOSE_ACC>') {
      console.log("Connection closed by server")
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
    setLastProcessedIndex(0);
    setMessageHistory('');
    setLogMessage([]);
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
          <h3>Message Log:</h3>
          <textarea
            value={errorMessage.join('\n')}
            readOnly
            style={{ width: '100%', minHeight: '200px', resize: 'vertical' }}
          />
        </div>
      </div>
    </div>
  );
};