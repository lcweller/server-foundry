import { Footer } from '@/components/marketing/footer'
import { Hero } from '@/components/marketing/hero'
import { HowItWorks } from '@/components/marketing/how-it-works'
import { Nav } from '@/components/marketing/nav'
import { Problem } from '@/components/marketing/problem'
import { Solution } from '@/components/marketing/solution'
import { SupportedGames } from '@/components/marketing/supported-games'
import { Waitlist } from '@/components/marketing/waitlist'

export default function Home() {
  return (
    <>
      <Nav />
      <main className="flex flex-1 flex-col">
        <Hero />
        <Problem />
        <Solution />
        <HowItWorks />
        <SupportedGames />
        <Waitlist />
      </main>
      <Footer />
    </>
  )
}
