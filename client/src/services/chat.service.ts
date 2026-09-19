const API_URL = "http://localhost:3000";

export async function chatStream(message: string, onChunk: (chunk: string) => void) {
    const response = await fetch(
        `${API_URL}/api/ai/chat/stream`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message
            })
        }
    )

    if (!response.ok) {
        throw new Error("Failed to get AI response.")
    }

    if (!response.body) {
        throw new Error("Streaming is not support by this response")
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";
    
    while (true) {
        const { value, done} = await reader.read()

        if (done) {
            break;
        }

        buffer += decoder.decode(value, {
            stream: true
        })
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
            if (!event.startsWith("data: ")) continue;

            const data = event.slice(6);
            
            if (data === "[DONE]") return;

            try {
                const parsed = JSON.parse(data);
                if (parsed.error) throw new Error(parsed.error);
                onChunk(data);
            } catch {
                onChunk(data);
            }
        }
    }
}