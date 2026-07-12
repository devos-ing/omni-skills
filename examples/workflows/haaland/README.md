# Haaland Omniskills Workflow

Use this workflow when an agent should make exactly one playful Haaland/JTS meme:
a compact football-finisher joke, social caption, or parody post concept with a
clear punchline.

The included profile icon is an original parody asset at
`skills/haaland/assets/haaland-profile-icon.svg`. It is not an official player
photo, club, league, or sponsor mark.

Install it from the repo root:

```bash
rtk bun run dev -- install examples/workflows/haaland
```

Validate it while authoring:

```bash
rtk bun run dev -- validate examples/workflows/haaland
```

Refresh the checked skill fingerprints after editing the local meme skill:

```bash
rtk bun run dev -- lock examples/workflows/haaland
```
