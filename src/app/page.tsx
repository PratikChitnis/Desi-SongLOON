import Backdrop from "@/components/Backdrop";
import Station, { type ChannelInfo } from "@/components/Station";
import { fetchAllChannels, emptyChannels } from "@/lib/station";
import { apis } from "@/lib/config";

export default async function Home() {
  const hasKeys = apis.youtube.apiKey && apis.spotify.clientId;
  const channels = hasKeys ? await fetchAllChannels() : emptyChannels();

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
