import Box from "@mui/material/Box";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { Container } from "@mui/material";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
  onChange: (event: React.SyntheticEvent, value: any) => void;
}

export function TabPanel(props: TabPanelProps): JSX.Element {
  const { children, value, index, onChange, ...other } = props;

  const [startX, setStartX] = useState<number | null>(null);
  const [deltaX, setDeltaX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;

    function handleTouchStart(e) {
      setStartX(e.touches[0].clientX);
      setDeltaX(0);
      setIsSwiping(true);
    }

    function handleTouchMove(e) {
      if (!isSwiping) {
        return;
      }
      setDeltaX(e.touches[0].clientX - startX!);
    }

    function handleTouchEnd(e) {
      if (!isSwiping) {
        return;
      }
      setIsSwiping(false);
      if (deltaX < -50) {
        onChange(e, value + 1);
      } else if (deltaX > 50) {
        onChange(e, value - 1);
      }
    }

    element?.addEventListener(`touchstart`, handleTouchStart);
    element?.addEventListener(`touchmove`, handleTouchMove);
    element?.addEventListener(`touchend`, handleTouchEnd);

    return () => {
      element?.removeEventListener(`touchstart`, handleTouchStart);
      element?.removeEventListener(`touchmove`, handleTouchMove);
      element?.removeEventListener(`touchend`, handleTouchEnd);
    };
  }, [isSwiping, deltaX, startX, value, onChange]);

  return (
    <Container
      disableGutters={true}
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box ref={ref} display="flex" justifyContent="center" sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </Container>
  );
}
