import Backdrop from "@/components/Backdrop";
import Station from "@/components/Station";
import { station } from "@/lib/station";

export default function Home() {
  return (
    <Backdrop>
      <Station tagline={station.tagline} />
    </Backdrop>
  );
}
