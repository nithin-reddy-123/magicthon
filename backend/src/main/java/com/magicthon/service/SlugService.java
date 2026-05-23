package com.magicthon.service;

import com.magicthon.repository.MemeRepository;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;

@Service
public class SlugService {

    private static final String ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
    private final SecureRandom rnd = new SecureRandom();
    private final MemeRepository memes;

    public SlugService(MemeRepository memes) {
        this.memes = memes;
    }

    public String newUniqueSlug() {
        for (int attempt = 0; attempt < 8; attempt++) {
            String s = generate(6);
            if (!memes.existsBySlug(s)) return s;
        }
        return generate(8);
    }

    private String generate(int len) {
        StringBuilder sb = new StringBuilder(len);
        for (int i = 0; i < len; i++) {
            sb.append(ALPHABET.charAt(rnd.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }
}
