package com.magicthon.controller;

import com.magicthon.dto.ReactionRequest;
import com.magicthon.dto.ReactionTotals;
import com.magicthon.dto.SaveMemeRequest;
import com.magicthon.dto.SaveMemeResponse;
import com.magicthon.entity.Meme;
import com.magicthon.service.MemeService;
import com.magicthon.service.ReactionStream;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Map;

@RestController
@RequestMapping("/api/memes")
public class MemeController {

    private final MemeService memes;
    private final ReactionStream stream;

    public MemeController(MemeService memes, ReactionStream stream) {
        this.memes = memes;
        this.stream = stream;
    }

    @PostMapping
    public SaveMemeResponse save(@Valid @RequestBody SaveMemeRequest req) {
        return memes.save(req);
    }

    @GetMapping("/{slug}")
    public Map<String, Object> get(@PathVariable String slug) {
        Meme m = memes.get(slug);
        return Map.of(
                "slug", m.getSlug(),
                "caption", m.getCaption() == null ? "" : m.getCaption(),
                "imageUrl", "/api/memes/" + m.getSlug() + "/image",
                "createdAt", m.getCreatedAt().toString()
        );
    }

    @GetMapping("/{slug}/image")
    public ResponseEntity<byte[]> image(@PathVariable String slug) {
        Meme m = memes.get(slug);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, m.getContentType() == null ? "image/png" : m.getContentType())
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=86400")
                .body(m.getImageBytes());
    }

    @PostMapping("/{slug}/reactions")
    public ReactionTotals react(@PathVariable String slug, @Valid @RequestBody ReactionRequest req) {
        return memes.react(slug, req.kind());
    }

    @GetMapping("/{slug}/reactions")
    public ReactionTotals totals(@PathVariable String slug) {
        return memes.totals(slug);
    }

    @GetMapping(value = "/{slug}/reactions/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamReactions(@PathVariable String slug) {
        return stream.subscribe(slug);
    }
}
