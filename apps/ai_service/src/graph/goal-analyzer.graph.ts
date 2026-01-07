
import { Injectable, Logger } from '@nestjs/common';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { GoalAnalyzerAnnotation, TitleDescriptionType } from './state.annotation';
import { BaseMessage, SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { END, Send, START, StateGraph } from '@langchain/langgraph';
import { ConfigurableAnnotation } from './configurable.annotation';
import { z } from 'zod';


@Injectable()
export class GoalAnalyzerGraph {
    private readonly name = 'Goal Analyzer';
    private readonly logger = new Logger(GoalAnalyzerGraph.name);

    private readonly compiledGraph;

    constructor() {
        this.compiledGraph = this.compile();
    }


    graph() {
        return this.compiledGraph;
    }

    private compile() {
        const stateGraph = new StateGraph(
            GoalAnalyzerAnnotation,
            ConfigurableAnnotation,
        );

        return stateGraph
            .addNode('goalAnalyzer', this.goalAnalyzer.bind(this))
            .addNode('topicGenerator', this.topicGenerator.bind(this))
            .addNode('subtopicGenerator', this.subtopicGenerator.bind(this))
            .addNode('resourceGenerator', this.resourceGenerator.bind(this))
            .addNode('projectGenerator', this.projectGenerator.bind(this))
            .addEdge(START, 'goalAnalyzer')
            .addConditionalEdges('goalAnalyzer', (state) => {
                if (state.goalType === 'broad' || state.goalType === 'small') {
                    return 'topicGenerator';
                }
                else if (state.goalType === 'specific') {
                    return 'resourceGenerator';
                }
                return END;
            })
            .addEdge('topicGenerator', END)
            .compile();
    }

    private goalAnalyzerModel() {
        const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            this.logger.warn('Google GenAI API key not found. Set GOOGLE_GENAI_API_KEY or GOOGLE_API_KEY in environment.');
        }
        return new ChatGoogleGenerativeAI({
            model: 'gemini-2.0-flash-lite',
            disableStreaming: true,
            apiKey,
        });
    }

    private goalAnalyzerPrompt(userRequest: string) {
        const systemMessage = new SystemMessage(
            {
                name: "system",
                content: `You are an expert AI Goal Analyzer. Your task is to analyze a user's goal description and classify it into one of the following goal types: 'broad', 'specific', 'small', or 'unclear'.
    ### Definitions:
    - **Broad Goal:** Involves multiple topics and subtopics. Example: 'I want to become a full-stack developer.'
    - **Specific Goal:** Has a clear, concrete objective (project-level). Example: 'I want to build a portfolio website.'
    - **Small Goal:** Focused on one topic or skill with limited scope. Example: 'I want to learn Docker.'
    - **Unclear Goal:** Too vague to categorize confidently. Example: 'I want to improve myself.'
    
    ### Instructions:
    1. Identify the goal type clearly.
    2. Return a structured JSON with reasoning and hierarchy.
    3. Ask 2 clarifying follow-up questions if the goal is 'unclear'.`,
            }
        );

        const humanMessage = new HumanMessage(
            {
                name: "user",
                content: `### User's Goal:
    ${userRequest}`,
            }
        );

        return [systemMessage, humanMessage];
    }


    private async goalAnalyzer(state: typeof GoalAnalyzerAnnotation.State) {
        const model = this.goalAnalyzerModel();
        const promptMessages = this.goalAnalyzerPrompt(state.userRequest);
        const response = await model.withStructuredOutput(this.responseFormat()).invoke(promptMessages);
        state.goalType = response.goal_type;
        state.goal = {
            id: `goal_${Date.now()}`,
            title: response.goal_title,
            description: response.goal_summary,
        };
        return state;
    }

    private responseFormat() {
        return z.object({
            goal_title: z.string().describe("A concise title for the user's goal."),
            goal_summary: z.string().describe("A brief summary of the user's goal."),
            goal_type: z.enum(['broad', 'specific', 'small', 'unclear']).describe("The classified type of the goal."),
            reasoning: z.string().describe("Explanation of why this goal type was chosen."),
            follow_up_questions: z.array(z.string()).describe("List of 2 clarifying follow-up questions if the goal is 'unclear'."),
        });
    }

    /**
     * Convenience method to analyze a single goal string without manually managing state.
     */
    async analyzeGoal(goalText: string) {
        const initialState: typeof GoalAnalyzerAnnotation.State = {
            messages: [new HumanMessage(goalText)],
        } as any; // cast because we only need messages for now
        const result = await this.graph().invoke(initialState);
        return result;
    }

    private topicGeneratorModel() {
        const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            this.logger.warn('Google GenAI API key not found. Set GOOGLE_GENAI_API_KEY or GOOGLE_API_KEY in environment.');
        }
        return new ChatGoogleGenerativeAI({
            model: 'gemini-2.0-flash-lite',
            disableStreaming: true,
            apiKey,
        });
    }

    private topicGeneratorPrompt(goal: TitleDescriptionType) {
        const systemMessage = new SystemMessage(
            {
                name: "system",
                content: `You are an expert AI Topic Generator. Your task is to generate relevant topics based on a user's broad goal description.
    ### Instructions:
    1. Analyze the broad goal provided by the user.
    2. Generate a list of relevant topics that align with the goal.
    3. Return the topics in a structured JSON format.
    ### User's Broad Goal:
    Title: ${goal.title}
    Description: ${goal.description}`,
            }
        );
        return systemMessage;
    }

    private topicResponseFormat() {
        return z.object({
            topics: z.array(z.object({
                title: z.string().describe("The title of the topic."),
                description: z.string().describe("A brief description of the topic."),
            })).describe("List of generated topics relevant to the broad goal."),
        });
    }


    private async topicGenerator(state: typeof GoalAnalyzerAnnotation.State) {
        const model = this.topicGeneratorModel();
        const prompt = this.topicGeneratorPrompt(state.goal);
        const response = await model.withStructuredOutput(this.topicResponseFormat()).invoke([prompt]);
        state.topics = response.topics.map((topic: any) => ({
            id: `topic_${Date.now()}`,
            title: topic.title,
            description: topic.description,
        }));
        return state;
    }

    private subtopicGeneratorModel() {
        const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            this.logger.warn('Google GenAI API key not found. Set GOOGLE_GENAI_API_KEY or GOOGLE_API_KEY in environment.');
        }
        return new ChatGoogleGenerativeAI({
            model: 'gemini-2.0-flash-lite',
            disableStreaming: true,
            apiKey,
        });
    }

    private subtopicGeneratorPrompt(topic: TitleDescriptionType) {
        const systemMessage = new SystemMessage(
            {
                name: "system",
                content: `You are an expert AI Subtopic Generator. Your task is to generate relevant subtopics based on a user's broad goal description and identified topics.
    ### Instructions:
    1. Analyze the broad goal and topics provided by the user.
    2. Generate a list of relevant subtopics for each topic.
    3. Return the subtopics in a structured JSON format.
    ### Topic:
    Title: ${topic.title}
    Description: ${topic.description}
    `,
            }
        );
        return systemMessage;
    }

    private subtopicResponseFormat() {
        return z.object({
            subtopics: z.array(z.object({
                title: z.string().describe("The title of the subtopic."),
                description: z.string().describe("A brief description of the subtopic."),
            })).describe("List of generated subtopics relevant to the identified topics."),
        });

    }

    private async subtopicGenerator(state: typeof GoalAnalyzerAnnotation.State, topic: TitleDescriptionType) {
        const model = this.subtopicGeneratorModel();
        const prompt = this.subtopicGeneratorPrompt(topic);
        const response = await model.withStructuredOutput(this.subtopicResponseFormat()).invoke([prompt]);
        const subtopics = response.subtopics.map((subtopic: any) => ({
            id: `subtopic_${Date.now()}`,
            title: subtopic.title,
            description: subtopic.description,
        }));
        if (!state.subtopics) {
            state.subtopics = {};
        }
        state.subtopics[topic.id] = subtopics;
        return state;
    }

    private async subtopicFanout(state: typeof GoalAnalyzerAnnotation.State) {
        return state.topics.map((topic) => {
            return new Send("subtopicGenerator", topic);
        });
    }

    private async resourceGeneratorPrompt(topic: TitleDescriptionType) {
        const systemMessage = new SystemMessage(
            {
                name: "system",
                content: `You are an expert AI Resource Generator. Your task is to generate relevant learning resources based on a user's topic description.
    ### Instructions:
    1. Analyze the topic provided by the user.
    2. Generate a list of relevant learning resources (articles, tutorials, videos, courses).
    3. Return the resources in a structured JSON format.
    ### Topic:
    Title: ${topic.title}
    Description: ${topic.description}
    `,
            }
        );
        return systemMessage;
    }

    private resourceResponseFormat() {
        return z.object({
            resources: z.array(z.object({
                title: z.string().describe("The title of the resource."),
                link: z.string().describe("The URL link to the resource."),
                type: z.string().describe("The type of resource (e.g., article, video, course)."),
            })).describe("List of generated learning resources relevant to the topic."),
        });
    }

    private async resourceGenerator(state: typeof GoalAnalyzerAnnotation.State, topic: TitleDescriptionType) {
        const model = this.subtopicGeneratorModel();
        const prompt = await this.resourceGeneratorPrompt(topic);
        const response = await model.withStructuredOutput(this.resourceResponseFormat()).invoke([prompt]);
        const resources = response.resources.map((resource: any) => ({
            title: resource.title,
            link: resource.link,
            type: resource.type,
        }));
        if (!state.resources) {
            state.resources = {};
        }
        state.resources[topic.id] = resources;
        return state;
    }

    private async resourceFanout(state: typeof GoalAnalyzerAnnotation.State, topic: TitleDescriptionType) {
        if (state.goalType == 'broad') {
            state.subtopics[topic.id].forEach((subtopic) => {
                return new Send("resourceGenerator", subtopic);
            });
        } else if (state.goalType == 'small') {
            return new Send("resourceGenerator", topic);
        }
        return;
    }

    private async projectGeneratorPrompt(topic: TitleDescriptionType | string) {
        const systemMessage = new SystemMessage(
            {
                name: "system",
                content: `You are an expert AI Project Generator. Your task is to generate relevant projects based on a user's topic description.
    ### Instructions:
    1. Analyze the topic provided by the user.
    2. Generate a project idea that aligns with the topic.
    3. Return the project in a structured JSON format.
    ### Topic:
    Title: ${typeof topic === 'string' ? topic : topic.title}
    Description: ${typeof topic === 'string' ? "" : topic.description}
    `,
            }
        );
        return systemMessage;
    }

    private projectResponseFormat() {
        return z.object({
            project: z.object({
                name: z.string().describe("The name of the project."),
                description: z.string().describe("A brief description of the project."),
                difficulty: z.string().describe("The difficulty level of the project (e.g., easy, medium, hard)."),
            }).describe("Generated project relevant to the topic."),
        });
    }

    private async projectGenerator(state: typeof GoalAnalyzerAnnotation.State, topic: TitleDescriptionType | string) {
        const model = this.subtopicGeneratorModel();
        const prompt = await this.projectGeneratorPrompt(topic);
        const response = await model.withStructuredOutput(this.projectResponseFormat()).invoke([prompt]);
        const project = {
            name: response.project.name,
            description: response.project.description,
            difficulty: response.project.difficulty,
        };
        if (!state.projects) {
            state.projects = {};
        }
        const topicId = typeof topic === 'string' ? topic : topic.id;
        state.projects[topicId] = project;
        return state;
    }

    private async projectFanout(state: typeof GoalAnalyzerAnnotation.State, topic: TitleDescriptionType | string) {
        if (state.goalType == 'broad') {
            state.topics.forEach((topic) => {
                return new Send("projectGenerator", topic);
            });
        } else if (state.goalType == 'specific') {
            return new Send("projectGenerator", topic);
        }
        return;
    }


}