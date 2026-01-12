import type { Employee } from '@demo/shared';

/**
 * DetailPanel - Master-detail panel showing employee details
 * Matches Angular: app-detail-panel
 */
interface DetailPanelProps {
  employee: Employee;
}

export function DetailPanel({ employee }: DetailPanelProps) {
  const recentReviews = employee.performanceReviews.slice(-4);

  const getScoreClass = (score: number): string => {
    const level = score >= 4 ? 'high' : score >= 3 ? 'medium' : 'low';
    return `review-card__score--${level}`;
  };

  return (
    <div className="detail-panel">
      <div className="detail-grid">
        <div className="detail-section">
          <h4 className="detail-section__title">Active Projects</h4>
          <table className="detail-table">
            <thead>
              <tr className="detail-table__header">
                <th className="detail-table__header-cell">ID</th>
                <th className="detail-table__header-cell">Project</th>
                <th className="detail-table__header-cell">Role</th>
                <th className="detail-table__header-cell">Hours</th>
                <th className="detail-table__header-cell">Status</th>
              </tr>
            </thead>
            <tbody>
              {employee.activeProjects.map((project) => (
                <tr key={project.id} className="detail-table__row">
                  <td className="detail-table__cell">{project.id}</td>
                  <td className="detail-table__cell">{project.name}</td>
                  <td className="detail-table__cell">{project.role}</td>
                  <td className="detail-table__cell">{project.hoursLogged}h</td>
                  <td className="detail-table__cell">
                    <span className={`project-status project-status--${project.status}`}>{project.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="detail-section">
          <h4 className="detail-section__title">Performance Reviews</h4>
          <div className="reviews-grid">
            {recentReviews.map((review) => (
              <div key={`${review.quarter}-${review.year}`} className="review-card">
                <div className="review-card__period">
                  {review.quarter} {review.year}
                </div>
                <div className={`review-card__score ${getScoreClass(review.score)}`}>{review.score.toFixed(1)}</div>
                <div className="review-card__notes">{review.notes}</div>
              </div>
            ))}
          </div>
          <div className="skills-container">
            <h4 className="detail-section__title">Skills</h4>
            {employee.skills.map((skill) => (
              <span key={skill} className="skill-tag">
                {skill}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
