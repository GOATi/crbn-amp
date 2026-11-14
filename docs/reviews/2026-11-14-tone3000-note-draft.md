# A note to TONE3000, drafted for the owner to send (build plan R8)

**2026-11-14, SYNC:RIG-031.** The owner's pick at the kickoff: a session drafts the note and he sends it; the session
sends nothing. It asks the questions that `2026-11-14-tone3000-api-terms.md` (its "Recommendation", step 3) left open,
in TONE3000's own words where it can. To: support@tone3000.com. Before sending, check the terms page again
(https://www.tone3000.com/api/terms): it is new (effective 2026-07-07) and may have moved. The square brackets are his
to fill or cut.

---

**Subject:** API question from CRBN Rig (a free NAM player): free tier, offline play, sign-off

Hello TONE3000 team,

I make CRBN Rig, a free amp and pedal player built on Neural Amp Modeler (Steven Atkinson's MIT code). It runs as a web
page at rig.carbonlinear.com and as a Windows desktop app installed through our own launcher, Pavillion Hub. Players
keep their .nam captures and IRs in a folder on their own computer, and Rig lists and plays them. Most of those files
come from TONE3000, and we credit you and link to you inside the app today.

We would like to let players reach TONE3000 from inside Rig, through your API, and we want to do it within your terms.
We have read https://www.tone3000.com/api/terms and have a few questions before we build anything:

1. **What the free tier covers.** The terms say "Free tier integrations may only use the OAuth prompt flows
   (select_tone and load_tone)". Is that the whole of it? In particular, may a free integration also use the lists
   (favorited, downloaded, created, trending, latest), and `/models` with its `model_url`, so the capture a player
   picked in Select can be downloaded and played?
2. **Whether we count as commercial.** Rig is free and has no paid tier. It is distributed through Pavillion Hub, which
   also lists other apps of ours, some of which may be paid later. Does that make Rig "a product that accompanies a
   paid product" in your terms?
3. **Offline play.** Once a player has picked a capture through Select and Rig has downloaded it at their request, may
   Rig keep that file on that player's computer so it plays offline and at the next launch, with its creator, licence
   and a link back to the tone shown beside it? It would never be shared with anyone else, uploaded or cached for
   other players.
4. **What we would show.** We plan "Powered by TONE3000" with a link, each tone's image, gear, format and creator as
   your terms describe, and Select as the way into the full catalogue. Do you have design guidelines, or a logo pack,
   we should follow?
5. **Sign-off and limits.** If what we build needs your review, how do we ask for it, and what production rate limit
   should we plan for? We would not announce the feature before you are happy with it.

Our first step, if the free tier allows it, would be a "Browse TONE3000" button that opens your Select flow (PKCE in the
browser; the device flow or a loopback redirect on the desktop), plays the capture the player chose, and adds it to
their library with its credit. A search or browser of our own inside Rig would come only with your agreement.

Thank you, and thanks for what TONE3000 has done for the NAM community.

[Name]
[GOATi Entertainment Pty Ltd]
[A reply address]
