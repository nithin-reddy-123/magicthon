package com.magicthon.service;

import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class ReactionStream {

    private final Map<String, List<SseEmitter>> emittersBySlug = new ConcurrentHashMap<>();

    public SseEmitter subscribe(String slug) {
        SseEmitter emitter = new SseEmitter(0L);
        List<SseEmitter> list = emittersBySlug.computeIfAbsent(slug, k -> new CopyOnWriteArrayList<>());
        list.add(emitter);

        Runnable removal = () -> {
            List<SseEmitter> l = emittersBySlug.get(slug);
            if (l != null) l.remove(emitter);
        };
        emitter.onCompletion(removal);
        emitter.onTimeout(removal);
        emitter.onError(t -> removal.run());

        try {
            emitter.send(SseEmitter.event().name("ping").data("connected"));
        } catch (IOException e) {
            removal.run();
        }
        return emitter;
    }

    public void publish(String slug, Object payload) {
        List<SseEmitter> list = emittersBySlug.get(slug);
        if (list == null) return;
        for (SseEmitter emitter : list) {
            try {
                emitter.send(SseEmitter.event().name("reaction").data(payload));
            } catch (IOException e) {
                emitter.complete();
            }
        }
    }
}
