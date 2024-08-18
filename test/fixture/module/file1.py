from . import file2


def test_file2():
    assert file2.foo() == 'foo'


if __name__ == '__main__':
    test_file2()
    print("ok")
