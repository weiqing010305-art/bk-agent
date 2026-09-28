S = {-4, -2, 1, 2, 5, 0}

# Task 1
result1 = [[i, j, k] for i in S for j in S for k in S if i + j + k == 0]
print(result1)

# Task 2
result2 = [
    [i, j, k]
    for i in S for j in S for k in S
    if i + j + k == 0 and not (i == 0 and j == 0 and k == 0)
]
print(result2)

# Task 3
L = ["A", "B", "C", "D", "E"]
result3 = list(zip(range(len(L)), L))
print(result3)   # [(0, 'A'), (1, 'B'), (2, 'C'), (3, 'D'), (4, 'E')]

# Task 4
result4 = {i: i * i for i in range(100)}
print(result4)

# Task 5
def nextInts(L):
    return [x + 1 for x in L]

print(nextInts([1, 5, 7]))   