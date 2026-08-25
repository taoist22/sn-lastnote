import {buildPageList, buildUiTitleMap} from '../src/domain/pageMetadata';

describe('page metadata', () => {
  it('requests every native zero-based page', () => {
    expect(buildPageList(4)).toEqual([0, 1, 2, 3]);
  });

  it('maps native title pages to one-based user pages', () => {
    expect(
      buildUiTitleMap(
        [
          {page: 0, title: 'Start'},
          {page: 4, fullText: 'Conclusion'},
        ],
        5,
      ),
    ).toEqual({1: 'Start', 5: 'Conclusion'});
  });

  it('ignores invalid and out-of-range titles', () => {
    expect(
      buildUiTitleMap(
        [
          {page: -1, title: 'Bad'},
          {page: 3, title: 'Too far'},
          {page: 1, title: '  '},
        ],
        3,
      ),
    ).toEqual({});
  });
});
