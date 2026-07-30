import asyncio
import json

import websockets


async def verify_cdp():
    async with websockets.connect(
        "ws://127.0.0.1:3000/",
        open_timeout=30,
        close_timeout=10,
    ) as websocket:
        await websocket.send(json.dumps({"id": 1, "method": "Browser.getVersion"}))
        while True:
            response = json.loads(await asyncio.wait_for(websocket.recv(), timeout=30))
            if response.get("id") != 1:
                continue
            product = response.get("result", {}).get("product", "")
            if "Chrome" not in product:
                raise RuntimeError(f"unexpected CDP response: {response}")
            print(f"Sockpuppet Browser contract passed: {product}")
            return


asyncio.run(verify_cdp())
