package com.project.horror_site.repository;

import com.project.horror_site.model.Feedback;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface FeedbackRepository extends JpaRepository<Feedback, Long> {

    @Query("select coalesce(avg(f.rating), 0) from Feedback f")
    double averageRating();

    /** Para o dono do projeto ler; não é exposto publicamente. */
    List<Feedback> findTop50ByOrderByCreatedAtDesc();
}
