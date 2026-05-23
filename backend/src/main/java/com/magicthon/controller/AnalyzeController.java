package com.magicthon.controller;

import com.magicthon.dto.AnalyzeResponse;
import com.magicthon.service.ClaudeVisionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@RestController
@RequestMapping("/api")
public class AnalyzeController {

    private final ClaudeVisionService vision;

    public AnalyzeController(ClaudeVisionService vision) {
        this.vision = vision;
    }

    @PostMapping(value = "/analyze", consumes = "multipart/form-data")
    public ResponseEntity<AnalyzeResponse> analyze(@RequestParam("image") MultipartFile image) throws IOException {
        if (image.isEmpty()) return ResponseEntity.badRequest().build();
        AnalyzeResponse resp = vision.generateMemeIdeas(image.getBytes(), image.getContentType());
        return ResponseEntity.ok(resp);
    }
}
