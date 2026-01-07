import { Annotation } from "@langchain/langgraph";

export const ConfigurableAnnotation = Annotation.Root({
    userId: Annotation<string>(),
});