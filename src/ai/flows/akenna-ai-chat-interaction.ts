'use server';
/**
 * @fileOverview This file defines the Genkit flow for Akenna AI's chat interaction.
 * It takes a user's transcribed speech query, generates a natural language response
 * using an LLM, and then synthesizes that response into a spoken audio format.
 *
 * - akennaAIChatInteraction - The main function to interact with Akenna AI.
 * - AkennaAIChatInteractionInput - The input type for the chat interaction.
 * - AkennaAIChatInteractionOutput - The return type for the chat interaction.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as wav from 'wav';
import { googleAI } from '@genkit-ai/google-genai';

// Define the input schema for the chat interaction
const AkennaAIChatInteractionInputSchema = z.object({
  text: z.string().describe("The user's transcribed speech query."),
});
export type AkennaAIChatInteractionInput = z.infer<typeof AkennaAIChatInteractionInputSchema>;

// Define the output schema for the chat interaction
const AkennaAIChatInteractionOutputSchema = z.object({
  text: z.string().optional().describe("The AI's text response."),
  audio: z
    .string()
    .optional()
    .describe(
      "The AI's spoken response as an audio data URI (WAV format)."
    ),
  error: z.string().optional().describe("A user-friendly error message if the interaction fails."),
});
export type AkennaAIChatInteractionOutput = z.infer<typeof AkennaAIChatInteractionOutputSchema>;

// Helper function to convert PCM audio buffer to WAV format
async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 22050,
  sampleWidth = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    const bufs: any[] = [];
    writer.on('error', reject);
    writer.on('data', function (d) {
      bufs.push(d);
    });
    writer.on('end', function () {
      resolve(Buffer.concat(bufs).toString('base64'));
    });

    writer.write(pcmData);
    writer.end();
  });
}

// Define the prompt for generating the text response
const akennaChatPrompt = ai.definePrompt({
  name: 'akennaChatPrompt',
  input: { schema: AkennaAIChatInteractionInputSchema },
  output: { schema: z.object({ text: z.string().describe('The AI\'s text response.') }) },
  prompt: `You are Akenna AI, a helpful, intelligent, and engaging AI assistant. 
  Respond naturally and contextually to the user's query. Keep responses concise for voice interaction.
  If the user speaks in Tagalog, respond in a mix of Tagalog and English (Taglish) to be more conversational.
  
  User query: {{{text}}} `,
});

// Define the main Genkit flow for Akenna AI chat interaction
const akennaAIChatInteractionFlow = ai.defineFlow(
  {
    name: 'akennaAIChatInteractionFlow',
    inputSchema: AkennaAIChatInteractionInputSchema,
    outputSchema: AkennaAIChatInteractionOutputSchema,
  },
  async (input) => {
    try {
      // 1. Generate text response from the LLM
      let llmResponse;
      try {
        const { output } = await akennaChatPrompt(input);
        llmResponse = output;
      } catch (err: any) {
        if (err.message?.includes('429') || err.message?.includes('quota')) {
          return { error: 'Neural capacity reached. Please wait a moment.' };
        }
        console.error('[Flow] LLM Error:', err);
        return { error: 'Akenna is having trouble thinking right now.' };
      }

      if (!llmResponse?.text) {
        return { error: 'Failed to generate text response.' };
      }

      const textResponse = llmResponse.text;

      // 2. Convert the text response to speech using TTS model
      try {
        const { media } = await ai.generate({
          model: googleAI.model('gemini-2.5-flash-preview-tts'),
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Algenib' },
              },
            },
          },
          prompt: textResponse,
        });

        if (!media) {
          return { text: textResponse, error: 'Vocal synthesis failed, but here is my response.' };
        }

        const audioBuffer = Buffer.from(
          media.url.substring(media.url.indexOf(',') + 1),
          'base64'
        );
        const wavAudioBase64 = await toWav(audioBuffer);

        return {
          text: textResponse,
          audio: 'data:audio/wav;base64,' + wavAudioBase64,
        };
      } catch (err: any) {
        if (err.message?.includes('429') || err.message?.includes('quota')) {
          return { 
            text: textResponse, 
            error: 'Vocal synthesizer is cooling down. I will respond via text for now.' 
          };
        }
        return { text: textResponse, error: 'I am currently mute, but here is my response.' };
      }
    } catch (globalErr: any) {
      console.error('[Flow Error]:', globalErr);
      return { error: 'A critical system error occurred.' };
    }
  }
);

// Wrapper function to expose the flow
export async function akennaAIChatInteraction(
  input: AkennaAIChatInteractionInput
): Promise<AkennaAIChatInteractionOutput> {
  return akennaAIChatInteractionFlow(input);
}
