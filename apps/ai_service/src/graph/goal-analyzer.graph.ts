
import { Injectable, Logger } from '@nestjs/common';
import { ChatGroq } from '@langchain/groq';
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
            .addNode('resourceFanOutGenerator', this.resourceFanOutGenerator.bind(this))
            .addNode('projectGenerator', this.projectGenerator.bind(this))
            .addNode('projectFanOutGenerator', this.projectFanOutGenerator.bind(this))
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
            .addConditionalEdges('topicGenerator', this.combinedFanout.bind(this))
            .addEdge('subtopicGenerator', END)
            .addEdge('resourceGenerator', END)
            .addEdge('projectGenerator', END)
            .addEdge('resourceFanOutGenerator', END)
            .addEdge('projectFanOutGenerator', END)
            .compile();
    }

    private goalAnalyzerModel() {
        z
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            this.logger.warn('Groq API key not found. Set GROQ_API_KEY in environment.');
        }
        return new ChatGroq({
            model: 'llama-3.3-70b-versatile',
            temperature: 0.7,
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
                name: "human",
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
            userRequest: goalText,
        } as any;
        const result = await this.graph().invoke(initialState);
        return result;
    }

    private topicGeneratorModel() {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            this.logger.warn('Groq API key not found. Set GROQ_API_KEY in environment.');
        }
        return new ChatGroq({
            model: 'llama-3.3-70b-versatile',
            temperature: 0.7,
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
        let id = 0;
        state.topics = response.topics.map((topic: any) => ({
            id: `topic_${id++}`,
            title: topic.title,
            description: topic.description,
        }));
        return state;
    }

    private subtopicGeneratorModel() {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            this.logger.warn('Groq API key not found. Set GROQ_API_KEY in environment.');
        }
        return new ChatGroq({
            model: 'llama-3.3-70b-versatile',
            temperature: 0.7,
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

    private async subtopicGenerator(topic: TitleDescriptionType) {
        const model = this.subtopicGeneratorModel();
        const prompt = this.subtopicGeneratorPrompt(topic);
        const response = await model.withStructuredOutput(this.subtopicResponseFormat()).invoke([prompt]);
        let id = 0;
        const subtopics = response.subtopics.map((subtopic: any) => ({
            id: `subtopic_${id++}`,
            title: subtopic.title,
            description: subtopic.description,
        }));

        // Return the subtopics keyed by topic ID for state merging
        return {
            subtopics: {
                [topic.id]: subtopics
            }
        };
    }

    private async combinedFanout(state: typeof GoalAnalyzerAnnotation.State) {

        const sends: Send[] = [];

        // Subtopics for broad goals
        if (state.goalType === 'broad' && state.topics?.length > 0) {
            state.topics.forEach((topic) => {
                sends.push(new Send("subtopicGenerator", topic));
            });
        }

        // Resources for broad and small goals
        if ((state.goalType === 'broad' || state.goalType === 'small') && state.topics?.length > 0) {
            state.topics.forEach((topic) => {
                sends.push(new Send("resourceFanOutGenerator", topic));
            });
        }

        // Projects for broad and small goals
        if ((state.goalType === 'broad' || state.goalType === 'small') && state.topics?.length > 0) {
            state.topics.forEach((topic) => {
                sends.push(new Send("projectFanOutGenerator", topic));
            });
        }

        return sends;
    }

    private async resourceGeneratorPrompt(topic: TitleDescriptionType) {
        const systemMessage = new SystemMessage(
            {
                name: "system",
                content: `You are an expert Resource Generator. Your task is to generate relevant learning resources based on a user's topic description.
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

    private async resourceGenerator(state: typeof GoalAnalyzerAnnotation.State) {
        const model = this.subtopicGeneratorModel();
        const prompt = await this.resourceGeneratorPrompt(state.goal);
        const response = await model.withStructuredOutput(this.resourceResponseFormat()).invoke([prompt]);
        const resources = response.resources.map((resource: any) => ({
            title: resource.title,
            link: resource.link,
            type: resource.type,
        }));
        if (!state.resources) {
            state.resources = {};
        }
        state.resources[state.goal.id] = resources;
        return state;
    }

    private async resourceFanOutGenerator(topic: TitleDescriptionType) {
        const model = this.subtopicGeneratorModel();
        const prompt = await this.resourceGeneratorPrompt(topic);
        const response = await model.withStructuredOutput(this.resourceResponseFormat()).invoke([prompt]);
        const resources = response.resources.map((resource: any) => ({
            title: resource.title,
            link: resource.link,
            type: resource.type,
        }));

        return {
            resources: {
                [topic.id]: resources
            }
        };
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

    private async projectGenerator(state: typeof GoalAnalyzerAnnotation.State) {
        const model = this.subtopicGeneratorModel();
        const prompt = await this.projectGeneratorPrompt(state.goal);
        const response = await model.withStructuredOutput(this.projectResponseFormat()).invoke([prompt]);
        const project = {
            name: response.project.name,
            description: response.project.description,
            difficulty: response.project.difficulty,
        };
        if (!state.projects) {
            state.projects = {};
        }
        state.projects[state.goal.id] = project;
        return state;
    }

    private async projectFanOutGenerator(topic: TitleDescriptionType) {
        const model = this.subtopicGeneratorModel();
        const prompt = await this.projectGeneratorPrompt(topic);
        const response = await model.withStructuredOutput(this.projectResponseFormat()).invoke([prompt]);
        const project = {
            name: response.project.name,
            description: response.project.description,
            difficulty: response.project.difficulty,
        };
        return {
            projects: {
                [topic.id]: project
            }
        };
    }


}