import Backdrop from "@/components/Backdrop";
import Station from "@/components/Station";
import { channels, DEFAULT_CHANNEL } from "@/lib/channels";

export default function Home() {
  const summary = channels.map(({ id, name, tagline }) => ({ id, name, tagline }));
  return (
    <Backdrop>
      <Station channels={summary} initialChannel={DEFAULT_CHANNEL} />
    </Backdrop>
  );
}
