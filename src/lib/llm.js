/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {GoogleGenAI, Modality} from '@google/genai'
import pLimit from 'p-limit'

const timeoutMs = 123_333
const maxRetries = 5
const baseDelay = 1_233
let ai;
const limit = pLimit(2);

const getAi = () => {
  if (!ai) {
    ai = new GoogleGenAI({apiKey: process.env.API_KEY});
  }
  return ai;
}

export default (args) => limit(async () => {
    const {model, prompt, inputFile, signal} = args;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), timeoutMs)
        )

        const parts = []
        if (inputFile) {
          parts.push({
            inlineData: {
              data: inputFile.split(',')[1],
              mimeType: 'image/jpeg'
            }
          })
        }
        parts.push({text: prompt})

        const modelPromise = getAi().models.generateContent({
          model,
          config: {responseModalities: [Modality.IMAGE]},
          contents: {parts}
        })

        const response = await Promise.race([modelPromise, timeoutPromise])

        if (!response.candidates || response.candidates.length === 0) {
          throw new Error('No candidates in response')
        }

        const candidate = response.candidates[0];

        if (!candidate.content || !candidate.content.parts) {
            console.error('API response blocked or malformed:', response);
            throw new Error('No content found in API response, possibly due to safety filters.');
        }

        const inlineDataPart = candidate.content.parts.find(
          p => p.inlineData
        )
        if (!inlineDataPart) {
          throw new Error('No inline data found in response')
        }

        return 'data:image/png;base64,' + inlineDataPart.inlineData.data
      } catch (error) {
        if (signal?.aborted || error.name === 'AbortError') {
          return
        }

        if (attempt === maxRetries - 1) {
          throw error
        }

        const delay = baseDelay * 2 ** attempt
        await new Promise(res => setTimeout(res, delay))
        console.warn(
          `Attempt ${attempt + 1} failed, retrying after ${delay}ms...`
        )
      }
    }
})