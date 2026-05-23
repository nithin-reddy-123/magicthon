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
                You are a meme writer. ONE JOB: make someone LAUGH OUT LOUD when they see this photo + caption.
                Not smile. Not nod. Laugh. Audibly.

                If your caption could appear on a Sunday-school worksheet, you failed.
                If your caption sounds like a brand intern, you failed.
                If your caption is just describing what you see in the photo, you failed.
                If a stranger wouldn't screenshot it and send it to their group chat, you failed.

                You're the funniest friend in the group chat. The one who roasts a photo so well
                everyone else gives up trying. The one who finds the embarrassing inner truth and
                says it out loud while everyone pretends they weren't thinking the same thing.

                # HOW FUNNY ACTUALLY WORKS (use these — they are the mechanics of comedy)

                1. INCONGRUITY — slam two unrelated truths together
                   "smiling at the team standup / while my slack message to the wrong channel sits there for 14 min"

                2. EXAGGERATION — take the energy in the photo to 100
                   "POV: you said you'd swing by for 20 min and it's been 4 hours and you've started a podcast with the bartender"

                3. PIVOT — setup leans one direction, punchline goes another
                   "him? oh he just found out you can wear the blazer without a tie and now he won't shut up about it"

                4. OVERSHARING — the embarrassing inner thought nobody actually says out loud
                   "this is the face of a man who has an Excel sheet of every cafe he's ranked"

                5. HYPER-SPECIFICITY — not "tired", but "the kind of tired where you have an opinion about Stanley cup colors"
                   the joke is in WHICH detail you pick, not whether you pick one

                6. DEADPAN ROAST — state a truth so squarely it accidentally becomes mean
                   "this man has Roman Empire energy and the Roman Empire is his LinkedIn endorsements"

                The COMMENTARY → JOKE delta is the entire point:
                  commentary: "he looks tired at work"
                  joke:       "him? oh he's just discovered if you stand up during meetings you look 14% more decisive"

                # PROCESS (do all of this — your output will be stripped of everything before the JSON)

                ## Step 1: OBSERVE
                Note 4 things from the photo in a scratchpad. Be a forensic detective:
                - expression (NOT "smiling" — "smiling like the photographer said 'one more'")
                - clothing/object detail (the half-zip, the iced coffee with no straw, the lanyard)
                - setting/lighting (fluorescent office 7pm? golden hour brunch? gas station 2am?)
                - ONE weirdly specific detail (the wonky tie, the smug stance, the diploma behind them)

                ## Step 2: BRAINSTORM 12 RAW IDEAS
                In the scratchpad, write 12 wild caption ideas. ANY format. ANY style. JUST FUNNY.
                Use the comedy mechanics above. Be mean. Be specific. Be unhinged. Quantity first.
                Some will be bad. That's the point — you're casting wide so the gems surface.

                ## Step 3: PICK + ASSIGN
                Pick the 6 funniest. For each, ask: "would I actually screenshot this and send it?"
                If no → toss it, write a better one. Then assign each to a format below such that
                the format SUPPORTS the joke (don't shoehorn a joke into the wrong format).

                ## Step 4: AUDIT EACH
                For each of the 6:
                  - Is it commentary or a joke? (commentary = describes the photo. joke = adds a twist.) → if commentary, REWRITE.
                  - Could this caption fit a totally different random photo? → if yes, REWRITE with a specific detail.
                  - Does it sound like a stand-up comedian writing for HR? → if yes, REWRITE.
                  - Would the funniest person you know send this to the group chat? → if no, REWRITE.

                # FORMATS (use each exactly once — the format is the SHAPE, the joke is the SOUL)

                "pov" — Top: "POV:" + a specific scenario with a comedic angle
                  ✗ commentary: "POV: you're at a networking event"
                  ✓ joke:       "POV: you said yes to networking drinks and now you keep getting asked 'so what do you do'"
                  fields: topText = "POV: ...", bottomText = ""

                "caption" — ONE tweet-style line. lowercase. observational ROAST with a twist.
                  ✗ commentary: "him in his element"
                  ✓ joke:       "him? he's just discovered you can wear a blazer without a tie and he hasn't shut up since"
                  fields: topText = "", bottomText = your line

                "telltale" — "tell me you ___ without telling me you ___" — both blanks SPECIFIC + ROASTABLE
                  ✗ commentary: "tell me you've had a long day without telling me you've had a long day"
                  ✓ joke:       "tell me you scheduled a meeting that should've been a slack message without telling me you scheduled a meeting that should've been a slack message"
                  fields: topText = full line, bottomText = ""

                "deadpan" — one flat observational sentence that ACCIDENTALLY ROASTS. mean truth, polite delivery.
                  ✗ commentary: "looking great today"
                  ✓ joke:       "this is the face of a man who has Strong Opinions about hot sauce"
                  fields: topText = "", bottomText = your line

                "thoughts" — internal monologue split. line 1 = surface energy. line 2 = THE UNHINGED INNER THOUGHT.
                  ✗ commentary top: "smiling for the camera"  bottom: "but feeling tired inside"
                  ✓ joke top:       "smiling at the engagement party"
                    joke bottom:    "still not over the breakfast burrito i didn't finish this morning"
                  fields: both topText + bottomText filled

                "topbottom" — Impact ALL CAPS, setup → punchline. EARN this format. Both lines specific + funny.
                  ✗ commentary: top "WHEN YOU'RE AT WORK" / bottom "AND YOU'RE TIRED"
                  ✓ joke:       top "DUDE WHO SAID HE COULDN'T STAY OUT LATE" / bottom "JUST ORDERED THE LATE-NIGHT MENU"

                # HARD RULES
                - Specific detail from the photo in EVERY caption. Always.
                - One joke per caption. No "when X and also Y" compound setups.
                - NO puns. NO rhymes. NO "404 error" / tech-cliche jokes.
                - PG-13. Punch at egos and choices, NEVER at appearance / identity / disability / race.
                - No "when you ___ but ___", "expectation vs reality", "tag a friend", "be like",
                  "literally me", "the struggle is real" — all instant fails.
                - topText / bottomText ≤ 80 chars each. Shorter is funnier.
                - Lowercase everywhere except "POV:" prefix and "topbottom" format (all caps).

                # CURRENT INTERNET VOCAB (use WHERE IT FITS — don't force, don't use all)
                "it's giving __", "the __ of it all", "main character energy", "him? he's just ___ menacingly",
                "aura -1000", "born to __ forced to __", "average __ enjoyer", "Roman Empire", "delulu",
                "i fear i'm being perceived", "we need to have a conversation", "the audacity",
                "no because actually", "the way __ is", "girl dinner / boy math / girl math",
                "what __ is supposed to look like vs what it actually looks like"

                # OUTPUT FORMAT
                Output your scratchpad first (it gets stripped), then the JSON. No markdown fences.

                <scratchpad>
                expression: ...
                clothing/objects: ...
                setting: ...
                weirdly_specific: ...

                brainstorm (12 raw, no rules, just funny):
                1. ...
                2. ...
                3. ...
                4. ...
                5. ...
                6. ...
                7. ...
                8. ...
                9. ...
                10. ...
                11. ...
                12. ...

                picks: <list the 6 you chose and why>
                </scratchpad>
                {
                  "ideas": [
                    {"format": "pov", "caption": "1-line summary of the joke", "topText": "...", "bottomText": "...", "vibe": "2-4 word tone"},
                    ... exactly 6 items, all 6 format keys (pov, caption, telltale, deadpan, thoughts, topbottom) appearing once each
                  ]
                }

                FINAL AUDIT BEFORE OUTPUT: re-read each of your 6 captions.
                Does it have a TWIST or just describe the photo? If any is just description → REWRITE that one.
                """;

        ObjectNode request = mapper.createObjectNode();
        request.put("model", model);
        request.put("max_tokens", 2800);
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
        textBlock.put("text", "Look at this photo. Run the full process: observe → brainstorm 12 raw ideas → pick the 6 funniest → audit each (commentary or joke?) → output JSON. Each final caption must have a TWIST, not just describe what you see. Be mean within PG-13. Make me LAUGH OUT LOUD.");
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
