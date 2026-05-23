package com.magicthon.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class ErrorAdvice {

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> badArg(IllegalArgumentException e) {
        return ResponseEntity.status(400).body(Map.of("error", e.getMessage() == null ? "bad request" : e.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> badState(IllegalStateException e) {
        return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
    }
}
