import { useState, useEffect, useRef } from "react";

const useWebSocket = (url: string) => {
  const [data, setData] = useState<any>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!socketRef.current) {
      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.addEventListener(`open`, () => {
        console.log(`Connected to server`);
      });

      socket.addEventListener(`message`, (event) => {
        console.log(`Data received from server:`, event.data);
        const parsedData = JSON.parse(event.data);
        setData(parsedData);
      });

      socket.addEventListener(`error`, (error) => {
        console.error(`WebSocket error:`, error);
      });

      socket.addEventListener(`close`, () => {
        console.log(`WebSocket connection closed`);
        socketRef.current = null;
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [url]);

  return data;
};

export default useWebSocket;
