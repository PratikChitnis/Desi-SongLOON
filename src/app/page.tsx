import Backdrop from "@/components/Backdrop";
import Station from "@/components/Station";
import { channels } from "@/lib/station";

export default function Home() {
  return (
    <Backdrop>
      <Station
        channels={channels.map(({ id, name, tagline }) => ({ id, name, tagline }))}
      />
    </Backdrop>
  );
}
