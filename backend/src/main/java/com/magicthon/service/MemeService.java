package com.magicthon.service;

import com.magicthon.dto.ReactionTotals;
import com.magicthon.dto.SaveMemeRequest;
import com.magicthon.dto.SaveMemeResponse;
import com.magicthon.entity.Meme;
import com.magicthon.entity.Reaction;
import com.magicthon.repository.MemeRepository;
import com.magicthon.repository.ReactionRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class MemeService {

    private final MemeRepository memes;
    private final ReactionRepository reactions;
    private final SlugService slugs;
    private final ReactionStream stream;

    @Value("${app.public-base-url}")
    private String publicBaseUrl;

    public MemeService(MemeRepository memes, ReactionRepository reactions, SlugService slugs, ReactionStream stream) {
        this.memes = memes;
        this.reactions = reactions;
        this.slugs = slugs;
        this.stream = stream;
    }

    @Transactional
    public SaveMemeResponse save(SaveMemeRequest req) {
        String raw = req.imageBase64();
        if (raw.startsWith("data:")) {
            int comma = raw.indexOf(',');
            if (comma > 0) raw = raw.substring(comma + 1);
        }
        byte[] bytes = Base64.getDecoder().decode(raw);

        Meme m = new Meme();
        m.setSlug(slugs.newUniqueSlug());
        m.setCaption(req.caption());
        m.setImageBytes(bytes);
        m.setContentType(req.contentType() == null ? "image/png" : req.contentType());
        memes.save(m);

        String share = publicBaseUrl.replaceAll("/$", "") + "/m/" + m.getSlug();
        return new SaveMemeResponse(m.getSlug(), share);
    }

    public Meme get(String slug) {
        return memes.findBySlug(slug).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "meme not found"));
    }

    @Transactional
    public ReactionTotals react(String slug, String kind) {
        if (!memes.existsBySlug(slug)) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "meme not found");
        Reaction r = new Reaction();
        r.setMemeSlug(slug);
        r.setKind(kind);
        reactions.save(r);
        ReactionTotals totals = totals(slug);
        stream.publish(slug, totals);
        return totals;
    }

    public ReactionTotals totals(String slug) {
        Map<String, Long> counts = new HashMap<>();
        long total = 0;
        List<Object[]> rows = reactions.countByKindForSlug(slug);
        for (Object[] row : rows) {
            long c = ((Number) row[1]).longValue();
            counts.put((String) row[0], c);
            total += c;
        }
        return new ReactionTotals(slug, counts, total);
    }
}
