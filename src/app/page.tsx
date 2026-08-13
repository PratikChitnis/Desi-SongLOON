import Backdrop from "@/components/Backdrop";
import Station, { type ChannelInfo } from "@/components/Station";
import { channels } from "@/lib/station";

export default function Home() {
  const channelData: ChannelInfo[] = channels.map(({ id, name, tagline, tracks }) => ({
    id,
    name,
    tagline,
    tracks,
  }));

  return (
    <Backdrop>
      <Station channels={channelData} />
    </Backdrop>
  );
}
