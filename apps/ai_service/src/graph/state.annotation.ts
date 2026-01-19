import { BaseMessage } from '@langchain/core/messages';
import { Annotation } from '@langchain/langgraph';

export type TitleDescriptionType = {
    id: string;
    title: string;
    description: string;
};

type ResourceAnnotationType = {
    title: string;
    link: string;
    type: string;
};

type ProjectAnnotationType = {
    name: string;
    description: string;
    difficulty: string;
};


export const GoalAnalyzerAnnotation = Annotation.Root({
    userRequest: Annotation<string>(),
    goalType: Annotation<string>(),
    goal: Annotation<TitleDescriptionType>(),
    topics: Annotation<TitleDescriptionType[]>(),
    subtopics: Annotation<Record<string, TitleDescriptionType[]>>({
        reducer: (left, right) => ({ ...left, ...right }),
        default: () => ({}),
    }),
    resources: Annotation<Record<string, ResourceAnnotationType[]>>({
        reducer: (left, right) => ({ ...left, ...right }),
        default: () => ({}),
    }),
    projects: Annotation<Record<string, ProjectAnnotationType>>({
        reducer: (left, right) => ({ ...left, ...right }),
        default: () => ({}),
    }),
});

