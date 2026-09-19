export type MessageRole = "user" | "assistant";

export interface IChatMessage {
    id: string;
    role: MessageRole ;
    content: string;
}
