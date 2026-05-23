package com.magicthon.repository;

import com.magicthon.entity.Reaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ReactionRepository extends JpaRepository<Reaction, Long> {

    @Query("SELECT r.kind, COUNT(r) FROM Reaction r WHERE r.memeSlug = ?1 GROUP BY r.kind")
    List<Object[]> countByKindForSlug(String slug);
}
