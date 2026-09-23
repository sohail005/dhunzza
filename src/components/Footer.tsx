import Image from "next/image";

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-transparent px-5 py-8 text-center sm:px-8">
      <Image
        src="/dhunzza.webp"
        alt="Dhunzza"
        width={1254}
        height={1254}
        sizes="96px"
        className="mx-auto mb-1 h-auto w-24"
      />
      <p className="text-[16px] text-white/40">Dhunzza · playing all day</p>

      <p className="mx-auto mt-6 max-w-full text-[15.5px] leading-relaxed text-white/40">
        Disclaimer : All rights to the music streamed here stay with the respective labels,
        composers and performers. Song credits are put together from film soundtrack
        listings.
      </p>

      <p className="mt-4 text-[15.5px] text-white/40">© Sohail 2026</p>
    </footer>
  );
}
