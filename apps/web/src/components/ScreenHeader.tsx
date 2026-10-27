/** The top of every tab: a small caption, the screen's title, and an optional action on the right. */
export function ScreenHeader({ caption, title, action, children }: { caption?: string; title: React.ReactNode; action?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="screenHeader">
      <div className="screenHeaderRow">
        <div className="screenHeaderText">
          {caption && <p className="screenCaption">{caption}</p>}
          <h1 className="screenTitle">{title}</h1>
        </div>
        {action}
      </div>
      {children}
    </header>
  );
}
