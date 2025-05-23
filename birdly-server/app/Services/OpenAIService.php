<?php

namespace App\Services;

use App\Models\Guildbook;
use App\Models\Snippet;
use App\Traits\AiContextBuilder;
use OpenAI;

class OpenAIService {
    use AiContextBuilder;

    protected $client;

    public function __construct(
        protected GuildbookFileService $fileService,
        string $apiKey
    ) {
        $this->client = OpenAI::client($apiKey);
    }

    public function generateText(string $prompt): string {
        $context = $this->addLanguage('python')
            ->addTaskContext('q_and_a')
            ->buildContext();

        $context = $this->buildContext();
        $response = $this->client->chat()->create([
            'model' => 'gpt-3.5-turbo',
            'messages' => [
                ['role' => 'system', 'content' => $context],
                ['role' => 'user', 'content' => $prompt]
            ],
        ]);

        return $response->choices[0]->message->content;
    }

    public function historyPrompt(int $id) {
        $snippet = Snippet::find($id);
        if (!$snippet) return;

        $code = $snippet->code;
        $history = $snippet->history;

        // setup AiContext
        $context = $this->addLanguage('python')
            ->addTaskContext('playground')
            ->buildContext();

        $lastUserMessage = null;
        $lastAssistantResponse = null;

        // look back for the last response and prompt
        for ($i = count($history) - 1; $i >= 1; $i--) {
            if (
                $history[$i]['role'] === 'assistant' &&
                $history[$i - 1]['role'] === 'user'
            ) {
                $lastUserMessage = $history[$i - 1]['content'];
                $lastAssistantResponse = $history[$i]['content'];
                break;
            }
        }

        // if it is the same return them
        if ($lastUserMessage !== null && trim($code) === trim($lastUserMessage))
            return [$lastAssistantResponse, $history];


        $newHistory = array_merge(
            $history,
            [['role' => 'user', 'content' => $code]]
        );

        $response = $this->client->chat()->create([
            'model' => 'o3-mini',
            'messages' =>
            array_merge(
                [['role' => 'system', 'content' => $context]],
                $newHistory
            ),
        ]);

        $res = $response->choices[0]->message->content;
        $newHistory[] = ['role' => 'assistant', 'content' => $res];
        $newHistory = array_slice($newHistory, -10);
        $snippet->update(['history' => $newHistory]);

        return $res;
    }

    public function guildbookPrompt(int $id, string $prompt) {
        $guildbook = Guildbook::find($id);
        if (!$guildbook) return;

        $content = $this->fileService->read($guildbook->path);
        $history = $guildbook->history;

        $context = $this->addLanguage('python')
            ->addTaskContext('q_and_a')
            ->buildContext();

        $newHistory = array_merge(
            $history,
            [['role' => 'user', 'content' => 'content: \n' . $prompt]]
        );

        $response = $this->client->chat()->create([
            'model' => 'gpt-3.5-turbo',
            'messages' =>
            array_merge(
                [
                    ['role' => 'system', 'content' => $context],
                    ['role' => 'system', 'content' => $content]
                ],
                $newHistory
            ),
        ]);

        $res = $response->choices[0]->message->content;
        $newHistory[] = ['role' => 'assistant', 'content' => $res];
        $newHistory = array_slice($newHistory, -10);
        $guildbook->update(['history' => $newHistory]);
        return $res;
    }

    public function checkAnswer(string $userAnswer, string $question, string $correctAnswer): bool {
        $context = $this->addLanguage('python')
            ->addTaskContext('check')
            ->addQuestion($question, $correctAnswer)
            ->buildContext();

        $response = $this->client->chat()->create([
            'model' => 'gpt-3.5-turbo',
            'messages' => [
                ['role' => 'system', 'content' => $context],
                ['role' => 'user', 'content' => $userAnswer]
            ],
        ]);

        $content = trim($response['choices'][0]['message']['content'] ?? '');

        if ($content === 'true') {
            return true;
        } elseif ($content === 'false') {
            return false;
        } else {
            throw new \RuntimeException("Invalid response from AI: '$content'");
        }

        return $content;
    }
}
