package com.magicthon.entity;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "reactions", indexes = @Index(name = "idx_reactions_slug", columnList = "memeSlug"))
public class Reaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "meme_slug", nullable = false, length = 16)
    private String memeSlug;

    @Column(nullable = false, length = 32)
    private String kind;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getMemeSlug() { return memeSlug; }
    public void setMemeSlug(String memeSlug) { this.memeSlug = memeSlug; }
    public String getKind() { return kind; }
    public void setKind(String kind) { this.kind = kind; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
