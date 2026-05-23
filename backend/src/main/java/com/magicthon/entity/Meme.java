package com.magicthon.entity;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "memes", indexes = @Index(name = "idx_memes_slug", columnList = "slug", unique = true))
public class Meme {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 16)
    private String slug;

    @Column(length = 500)
    private String caption;

    @Column(name = "image_bytes", nullable = false, columnDefinition = "bytea")
    private byte[] imageBytes;

    @Column(name = "content_type", length = 64)
    private String contentType;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }
    public String getCaption() { return caption; }
    public void setCaption(String caption) { this.caption = caption; }
    public byte[] getImageBytes() { return imageBytes; }
    public void setImageBytes(byte[] imageBytes) { this.imageBytes = imageBytes; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
