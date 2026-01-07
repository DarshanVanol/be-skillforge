import { Annotation } from "@langchain/langgraph";

export const BroadGoalAnnotation = Annotation.Root({
    messages: Annotation<any[]>(),
    goal: Annotation<string>(),
});