package com.magicthon.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.magicthon.dto.AnalyzeResponse;
import com.magicthon.dto.MemeIdeaDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.List;

@Service
public class ClaudeVisionService {

    private final RestClient restClient;
    private final ObjectMapper mapper = new ObjectMapper();

    @Value("${app.anthropic.api-key}")
    private String apiKey;

    @Value("${app.anthropic.model}")
    private String model;

    @Value("${app.anthropic.base-url}")
    private String baseUrl;

    public ClaudeVisionService(RestClient restClient) {
        this.restClient = restClient;
    }

    public AnalyzeResponse generateMemeIdeas(byte[] imageBytes, String contentType) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("ANTHROPIC_API_KEY is not set");
        }

        String b64 = java.util.Base64.getEncoder().encodeToString(imageBytes);
        String mediaType = (contentType == null || contentType.isBlank()) ? "image/jpeg" : contentType;

        String systemPrompt = """
                You write captions for chronically-online 2025 Gen-Z / late millennial internet humor. Think:
                what they'd actually screenshot from the group chat — not what a brand intern thinks is funny,
                not stand-up comedy, not 2010s meme templates, not "minions on a Sunday" energy.

                # STEP 1: LOOK (do this first, mentally)
                Before writing anything, observe the photo like a forensic detective. Note:
                - exact micro-expression (not "smiling" — "smiling like the photographer said 'one more'")
                - specific clothing detail (the half-zip, the lanyard, the unbuttoned tie, the cargo shorts)
                - what's in their hands, on the table, behind them (the cup logo, the diploma, the airpods)
                - setting + lighting + time-of-day vibe (fluorescent office at 7pm? golden hour brunch? dorm room?)
                - posture / energy (slouched? performative? caught mid-sentence? trying too hard?)
                - ONE weirdly specific detail (a wonky eyebrow, the receipt sticking out of the pocket, the
                  ironic mug, the lighting from a single window)

                Every caption MUST name at least one of these specifics. The specificity test:
                "would this exact caption also work on a totally different photo?" If yes → REWRITE.

                # STEP 2: VOICE (how 2025 internet sounds)
                - lowercase. weird punctuation. run-on sentences with missing commas. fragments.
                - understatement, deadpan, self-aware drama
                - one joke per meme. no "when X and also Y" compound setups.
                - bait-and-switch: setup leans one way, punchline pivots

                Current vocab to weave in WHERE IT FITS (don't force any):
                  "it's giving __", "the __ of it all", "real ones know", "average __ enjoyer",
                  "aura -1000", "skill issue", "born to __, forced to __",
                  "i fear i'm being perceived", "no thoughts head empty", "delulu",
                  "no because actually", "the way __ is", "__ is sending me",
                  "girl dinner / boy math / girl math", "Roman Empire", "main character energy",
                  "what __ is supposed to look like vs what it actually looks like",
                  "the audacity", "we need to have a conversation", "him/her/them?? he's/she's just __ menacingly"

                # STEP 3: NEVER DO (instant fail — rewrite if you catch yourself)
                - "when you __ but __"  ← banned
                - "that face you make when" ← banned
                - "me: __ / also me: __" ← banned
                - "expectation vs reality" ← banned
                - "tag a friend who" / "anyone else or just me" ← banned
                - "be like" / "literally me" / "the struggle is real" ← banned
                - ANY pun. ANY rhyming joke. ANY "404 error not found" tech-cliche.
                - Any caption that could fit ANY photo. (The specificity test above.)
                - Punching down on appearance / weight / race / disability / personal identity. NEVER.
                - Profanity. Keep it PG-13.

                # STEP 4: FORMATS — use each exactly once
                Per format, here's what mid looks like vs great. Do NOT copy these texts — they
                illustrate the QUALITY DELTA, not content to reuse.

                "pov" — Top: "POV:" + a SPECIFIC scenario tied to the photo.
                  ✗ mid:  "POV: you're at a party"  (would fit any photo)
                  ✓ great: "POV: you said 'just one drink after work' to your coworkers 3 hours ago"
                  topText = "POV: <scenario>", bottomText = ""

                "caption" — one tweet-style observational line. lowercase. dry.
                  ✗ mid:  "such a great photo"  (means nothing)
                  ✓ great: "him? oh he just found out you can wear the suit jacket without the tie"
                  topText = "", bottomText = your line

                "telltale" — "tell me you __ without telling me you __" — fill BOTH blanks identically and SPECIFICALLY.
                  ✗ mid:   "tell me you're tired without telling me you're tired"
                  ✓ great: "tell me you peaked at your fraternity formal without telling me you peaked at your fraternity formal"
                  topText = your full line, bottomText = ""

                "deadpan" — one straight observational sentence. truth said flat. no setup, no punch.
                  ✗ mid:   "looking good!"
                  ✓ great: "this is the face of a man whose 'i'll do it tomorrow' just hit day 47"
                  topText = "", bottomText = your line

                "thoughts" — internal monologue split. line 1 = the surface. line 2 = what they're ACTUALLY thinking.
                  ✗ mid top:    "smiling for the camera"
                  ✗ mid bottom: "while feeling sad inside"
                  ✓ great top:    "smiling at the team standup"
                  ✓ great bottom: "while the slack message i sent to the wrong channel sits there for 14 minutes"

                "topbottom" — classic Impact ALL CAPS setup → punchline. Only earn this format if the joke
                  really wants the two-beat rhythm. Both lines specific.
                  ✗ mid:   top "WHEN YOU GO TO THE GYM" / bottom "BUT YOU'RE TIRED"
                  ✓ great: top "MAN WHO SAID HE WAS 'OUT' AT 9" / bottom "JUST ORDERED THE FINAL ROUND"

                # OUTPUT
                Return EXACTLY this — observations first (helps you stay specific; will be stripped),
                then the JSON. No markdown fences. No prose outside the tags.

                <observations>
                expression: <one phrase>
                clothing/objects: <specifics>
                setting: <vibe>
                weirdly_specific: <the one detail>
                </observations>
                {
                  "ideas": [
                    {"format": "pov", "caption": "1-line UI label of the joke", "topText": "...", "bottomText": "...", "vibe": "2-4 word tone"},
                    ...exactly 6, all 6 format keys (pov, caption, telltale, deadpan, thoughts, topbottom) appearing once each
                  ]
                }

                Length: topText/bottomText each ≤ 80 chars. Shorter is usually funnier.
                Casing: lowercase everywhere EXCEPT "POV:" prefix and the "topbottom" format (which is ALL CAPS).

                Before returning, audit each caption with the specificity test. If a caption could
                fit a different random photo → rewrite it with a detail from THIS photo.
                """;

        ObjectNode request = mapper.createObjectNode();
        request.put("model", model);
        request.put("max_tokens", 2000);
        request.put("temperature", 1.0);
        request.put("system", systemPrompt);

        ArrayNode messages = mapper.createArrayNode();
        ObjectNode userMsg = mapper.createObjectNode();
        userMsg.put("role", "user");

        ArrayNode content = mapper.createArrayNode();

        ObjectNode imageBlock = mapper.createObjectNode();
        imageBlock.put("type", "image");
        ObjectNode source = mapper.createObjectNode();
        source.put("type", "base64");
        source.put("media_type", mediaType);
        source.put("data", b64);
        imageBlock.set("source", source);
        content.add(imageBlock);

        ObjectNode textBlock = mapper.createObjectNode();
        textBlock.put("type", "text");
        textBlock.put("text", "Look at this photo properly. Write the <observations> block first, then 6 captions — one per format. Name at least one specific detail from the photo in EVERY caption. Apply the specificity test before returning.");
        content.add(textBlock);

        userMsg.set("content", content);
        messages.add(userMsg);
        request.set("messages", messages);

        JsonNode resp = restClient.post()
                .uri(baseUrl)
                .header("x-api-key", apiKey)
                .header("anthropic-version", "2023-06-01")
                .contentType(MediaType.APPLICATION_JSON)
                .body(request)
                .retrieve()
                .body(JsonNode.class);

        String text = extractText(resp);
        return parseIdeas(text);
    }

    private String extractText(JsonNode resp) {
        if (resp == null || !resp.has("content")) return "";
        StringBuilder sb = new StringBuilder();
        for (JsonNode block : resp.get("content")) {
            if ("text".equals(block.path("type").asText())) {
                sb.append(block.path("text").asText());
            }
        }
        return sb.toString();
    }

    private AnalyzeResponse parseIdeas(String text) {
        String trimmed = text.trim();
        int start = trimmed.indexOf('{');
        int end = trimmed.lastIndexOf('}');
        if (start < 0 || end < 0) {
            return new AnalyzeResponse(List.of());
        }
        String json = trimmed.substring(start, end + 1);
        try {
            JsonNode node = mapper.readTree(json);
            List<MemeIdeaDto> ideas = new ArrayList<>();
            JsonNode arr = node.path("ideas");
            if (arr.isArray()) {
                for (JsonNode i : arr) {
                    ideas.add(new MemeIdeaDto(
                            i.path("format").asText(""),
                            i.path("caption").asText(""),
                            i.path("topText").asText(""),
                            i.path("bottomText").asText(""),
                            i.path("vibe").asText("")
                    ));
                }
            }
            return new AnalyzeResponse(ideas);
        } catch (Exception e) {
            return new AnalyzeResponse(List.of());
        }
    }
}
