# Enso-Speedrun
Enso is a Tendermint-based L1 network that generates bytecode and maps smart contract interactions across chains, letting devs define outcomes and the network finds solutions to execute them.


## Prerequisites
- Node.js v18+
- npm or yarn
- Ethereum private keys (for authentication)
- Enso user IDs and Zealy user IDs


## Installation
```bash
git clone https://github.com/Gmhax/Enso-Speedrun.git
cd Enso-Speedrun
```

## Install dependencies:
```bash
npm install
```

## Create a .env file based on .env.example:
```bash
cp .env.example .env
nano .env
chmod 600 .env
echo ".env" >> .gitignore
```
### to get Zealy UID
- Open Zealy site, log in.
- Right click > Inspect (or press F12).
- Go to the Network tab.
- Reload the page.
- Look for identies check photo below
![image](https://github.com/user-attachments/assets/b277b4b5-4fa2-4a45-9761-fb79dac427e9)

## Create session
```bash
screen -S enso
```

## Execute
```bash 
node index.js
```

### Dettach session: CTRL A+D

Done ma bro!



